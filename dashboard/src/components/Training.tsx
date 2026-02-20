import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface TrainingStats {
  total: number;
  good_count: number;
  bad_count: number;
  pending_count: number;
  auto_learned_count: number;
  learned_total: number;
  learned_avg_confidence: string;
}

interface ResponseItem {
  id: string;
  conversation_id: string;
  message_id: string;
  visitor_message: string;
  ai_response: string;
  ai_provider: string;
  business_line: string;
  language: string;
  feedback: string | null;
  corrected_response: string | null;
  notes: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  auto_learned: boolean;
  csat_rating: number | null;
  created_at: string;
}

interface ScrapeLog {
  id: number;
  url: string;
  title: string;
  entries_added: number;
  entries_updated: number;
  status: string;
  error_message: string | null;
  scraped_at: string;
}

type SubTab = 'review' | 'scraper';

const LINE_COLORS: Record<string, string> = {
  boostic: '#3B82F6',
  binnacle: '#8B5CF6',
  marketing: '#10B981',
  tech: '#F59E0B',
};

export function Training() {
  const [subTab, setSubTab] = useState<SubTab>('review');
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeLog[]>([]);
  const [filter, setFilter] = useState('pending');
  const [lineFilter, setLineFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [scraping, setScraping] = useState(false);
  const [embedding, setEmbedding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.getTrainingStats(),
        api.getTrainingResponses({
          feedback: filter || undefined,
          businessLine: lineFilter || undefined,
          limit: '30',
        } as Record<string, string>),
      ]);
      setStats(s);
      setResponses(r);
    } catch (e) {
      console.error('Training load error:', e);
    }
    setLoading(false);
  }, [filter, lineFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadScrapeHistory = async () => {
    try {
      const h = await api.getScrapeHistory();
      setScrapeHistory(h);
    } catch (e) {
      console.error('Scrape history error:', e);
    }
  };

  useEffect(() => {
    if (subTab === 'scraper') loadScrapeHistory();
  }, [subTab]);

  const handleFeedback = async (id: string, feedback: 'good' | 'bad') => {
    try {
      await api.submitFeedback(id, {
        feedback,
        correctedResponse: correctionText || undefined,
        notes: notesText || undefined,
      });
      setCorrectionText('');
      setNotesText('');
      setExpandedId(null);
      await loadData();
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.triggerScrape();
      await loadScrapeHistory();
    } catch (e) {
      console.error('Scrape error:', e);
    }
    setScraping(false);
  };

  const handleEmbed = async () => {
    setEmbedding(true);
    try {
      await api.triggerEmbedKb();
    } catch (e) {
      console.error('Embed error:', e);
    }
    setEmbedding(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard label="Total respuestas" value={stats.total} color="#64748B" />
          <StatCard label="Pendientes" value={stats.pending_count} color="#F59E0B" />
          <StatCard label="Buenas" value={stats.good_count} color="#10B981" />
          <StatCard label="Malas" value={stats.bad_count} color="#EF4444" />
          <StatCard label="Auto-aprendidas" value={stats.auto_learned_count} color="#8B5CF6" />
          <StatCard label="Resp. aprendidas" value={stats.learned_total} color="#3B82F6" />
          <StatCard label="Confianza media" value={stats.learned_avg_confidence} color="#06B6D4" />
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <TabButton active={subTab === 'review'} onClick={() => setSubTab('review')}>
          Revisar respuestas
        </TabButton>
        <TabButton active={subTab === 'scraper'} onClick={() => setSubTab('scraper')}>
          Auto-actualización KB
        </TabButton>
      </div>

      {subTab === 'review' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="good">Buenas</option>
              <option value="bad">Malas</option>
            </select>
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todas las líneas</option>
              <option value="boostic">Boostic</option>
              <option value="binnacle">Binnacle</option>
              <option value="marketing">Marketing</option>
              <option value="tech">Tech</option>
            </select>
            <button onClick={loadData} style={btnSecondary}>
              Actualizar
            </button>
          </div>

          {/* Response list */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 120, borderRadius: 12, background: 'var(--rd-surface)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : responses.length === 0 ? (
            <EmptyState message={filter === 'pending' ? 'No hay respuestas pendientes de revisar' : 'No hay respuestas con este filtro'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {responses.map((r) => (
                <ResponseCard
                  key={r.id}
                  item={r}
                  expanded={expandedId === r.id}
                  onToggle={() => {
                    setExpandedId(expandedId === r.id ? null : r.id);
                    setCorrectionText(r.corrected_response || '');
                    setNotesText(r.notes || '');
                  }}
                  correctionText={correctionText}
                  notesText={notesText}
                  onCorrectionChange={setCorrectionText}
                  onNotesChange={setNotesText}
                  onFeedback={handleFeedback}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {subTab === 'scraper' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleScrape} disabled={scraping} style={btnPrimary}>
              {scraping ? 'Actualizando...' : 'Actualizar KB desde redegal.com'}
            </button>
            <button onClick={handleEmbed} disabled={embedding} style={btnSecondary}>
              {embedding ? 'Generando...' : 'Generar embeddings KB'}
            </button>
          </div>

          <div style={{ fontSize: 13, color: 'var(--rd-text-secondary)', lineHeight: 1.6 }}>
            El scraper se ejecuta automaticamente cada 24h. Extrae contenido de las paginas clave de
            redegal.com, detecta cambios y actualiza la base de conocimiento. Los embeddings vectoriales
            permiten busqueda semantica (RAG) para respuestas mas precisas.
          </div>

          {scrapeHistory.length > 0 && (
            <div style={{ borderRadius: 12, border: '1px solid var(--rd-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--rd-surface)', textAlign: 'left' }}>
                    <th style={thStyle}>Pagina</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Cambios</th>
                    <th style={thStyle}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeHistory.slice(0, 30).map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--rd-border)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{s.title || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--rd-text-secondary)', wordBreak: 'break-all' }}>{s.url}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: s.status === 'success' ? '#D1FAE5' : '#FEE2E2',
                          color: s.status === 'success' ? '#059669' : '#DC2626',
                        }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {s.entries_added > 0 && <span style={{ color: '#10B981' }}>+{s.entries_added} </span>}
                        {s.entries_updated > 0 && <span style={{ color: '#3B82F6' }}>~{s.entries_updated}</span>}
                        {s.entries_added === 0 && s.entries_updated === 0 && <span style={{ color: 'var(--rd-text-secondary)' }}>Sin cambios</span>}
                      </td>
                      <td style={tdStyle}>{formatDate(s.scraped_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12, border: '1px solid var(--rd-border)',
      background: 'var(--rd-surface)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--rd-text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: '1px solid ' + (active ? 'var(--rd-primary)' : 'var(--rd-border)'),
        background: active ? 'var(--rd-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--rd-text)',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function ResponseCard({
  item, expanded, onToggle, correctionText, notesText, onCorrectionChange, onNotesChange, onFeedback, formatDate,
}: {
  item: ResponseItem;
  expanded: boolean;
  onToggle: () => void;
  correctionText: string;
  notesText: string;
  onCorrectionChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onFeedback: (id: string, fb: 'good' | 'bad') => void;
  formatDate: (d: string) => string;
}) {
  const lineColor = LINE_COLORS[item.business_line] || '#64748B';

  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--rd-border)', overflow: 'hidden',
      background: 'var(--rd-surface)', transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            {item.business_line && (
              <span style={{
                padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: lineColor + '20', color: lineColor, textTransform: 'uppercase',
              }}>
                {item.business_line}
              </span>
            )}
            {item.language && (
              <span style={{
                padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                background: 'var(--rd-border)', color: 'var(--rd-text-secondary)',
              }}>
                {item.language}
              </span>
            )}
            {item.auto_learned && (
              <span style={{
                padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: '#EDE9FE', color: '#7C3AED',
              }}>
                Auto
              </span>
            )}
            {item.csat_rating && (
              <span style={{
                padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: item.csat_rating >= 4 ? '#D1FAE5' : '#FEF3C7',
                color: item.csat_rating >= 4 ? '#059669' : '#D97706',
              }}>
                CSAT {item.csat_rating}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--rd-text-secondary)' }}>
              {formatDate(item.created_at)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--rd-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong>Visitante:</strong> {item.visitor_message}
          </div>
        </div>

        {/* Feedback status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {item.feedback === 'good' && <FeedbackBadge type="good" />}
          {item.feedback === 'bad' && <FeedbackBadge type="bad" />}
          {!item.feedback && <FeedbackBadge type="pending" />}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-secondary)" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--rd-border)', paddingTop: 12 }}>
          {/* Visitor message */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 4 }}>Mensaje del visitante</div>
            <div style={{
              padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
              background: 'var(--rd-border)', color: 'var(--rd-text)',
            }}>
              {item.visitor_message}
            </div>
          </div>

          {/* AI response */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 4 }}>Respuesta del bot</div>
            <div style={{
              padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
              background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE',
            }}>
              {item.ai_response}
            </div>
          </div>

          {/* Correction field */}
          {!item.reviewed_at && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 4 }}>
                  Respuesta corregida (opcional)
                </div>
                <textarea
                  value={correctionText}
                  onChange={(e) => onCorrectionChange(e.target.value)}
                  placeholder="Escribe la respuesta ideal si la del bot no era correcta..."
                  rows={3}
                  style={textareaStyle}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 4 }}>
                  Notas (opcional)
                </div>
                <input
                  value={notesText}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Notas sobre esta respuesta..."
                  style={inputStyle}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onFeedback(item.id, 'good')}
                  style={{
                    ...btnFeedback,
                    background: '#D1FAE5', color: '#059669', border: '1px solid #A7F3D0',
                  }}
                >
                  <span style={{ fontSize: 16 }}>&#x1F44D;</span> Buena
                </button>
                <button
                  onClick={() => onFeedback(item.id, 'bad')}
                  style={{
                    ...btnFeedback,
                    background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
                  }}
                >
                  <span style={{ fontSize: 16 }}>&#x1F44E;</span> Mala
                </button>
              </div>
            </>
          )}

          {/* Already reviewed info */}
          {item.reviewed_at && (
            <div style={{ fontSize: 12, color: 'var(--rd-text-secondary)', marginTop: 8 }}>
              Revisada por <strong>{item.reviewer_name || 'sistema'}</strong> el {formatDate(item.reviewed_at)}
              {item.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>Notas: {item.notes}</div>}
              {item.corrected_response && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Respuesta corregida:</div>
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                    background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
                  }}>
                    {item.corrected_response}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackBadge({ type }: { type: 'good' | 'bad' | 'pending' }) {
  const config = {
    good: { bg: '#D1FAE5', color: '#059669', label: 'Buena' },
    bad: { bg: '#FEE2E2', color: '#DC2626', label: 'Mala' },
    pending: { bg: '#FEF3C7', color: '#D97706', label: 'Pendiente' },
  }[type];
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: config.bg, color: config.color,
    }}>
      {config.label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px', color: 'var(--rd-text-secondary)',
      borderRadius: 12, border: '1px dashed var(--rd-border)',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{message}</div>
      <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>Las respuestas del bot se registran automaticamente para revision</div>
    </div>
  );
}

// ─── Styles ───

const selectStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  border: '1px solid var(--rd-border)', background: 'var(--rd-surface)',
  color: 'var(--rd-text)', cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'var(--rd-primary)', color: '#fff', border: 'none', cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'var(--rd-surface)', color: 'var(--rd-text)',
  border: '1px solid var(--rd-border)', cursor: 'pointer',
};

const btnFeedback: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  transition: 'all 0.15s',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: '1.5',
  border: '1px solid var(--rd-border)', background: 'var(--rd-bg, #fff)',
  color: 'var(--rd-text)', resize: 'vertical', fontFamily: 'inherit',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 14px', borderRadius: 10, fontSize: 13,
  border: '1px solid var(--rd-border)', background: 'var(--rd-bg, #fff)',
  color: 'var(--rd-text)', fontFamily: 'inherit',
};

const thStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--rd-text-secondary)' };
const tdStyle: React.CSSProperties = { padding: '10px 14px' };
