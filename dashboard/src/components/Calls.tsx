import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface CallStats {
  total_calls: number;
  active_calls: number;
  completed_calls: number;
  failed_calls: number;
  recorded_calls: number;
  transcribed_calls: number;
  avg_duration: number;
  total_storage_bytes: number;
}

interface CallRecord {
  id: string;
  call_id: string;
  conversation_id: string;
  visitor_phone: string;
  agent_extension: string;
  business_line: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  has_transcript: boolean;
  started_at: string;
  ended_at: string | null;
  monitored_by: string | null;
  monitor_started_at: string | null;
}

interface CallDetail extends CallRecord {
  transcript: string | null;
  file_size_bytes: number | null;
  transcribed_at: string | null;
  language: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'En curso', color: '#059669', bg: '#D1FAE5' },
  ringing: { label: 'Sonando', color: '#2563EB', bg: '#DBEAFE' },
  ended: { label: 'Finalizada', color: '#64748B', bg: '#F1F5F9' },
  transferred: { label: 'Transferida', color: '#7C3AED', bg: '#EDE9FE' },
  failed: { label: 'Fallida', color: '#DC2626', bg: '#FEE2E2' },
  missed: { label: 'Perdida', color: '#D97706', bg: '#FEF3C7' },
};

const LINE_COLORS: Record<string, string> = {
  boostic: '#3B82F6', binnacle: '#8B5CF6', marketing: '#10B981', tech: '#F59E0B',
};

export function Calls() {
  const [stats, setStats] = useState<CallStats | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [transcribing, setTranscribing] = useState('');
  const [monitoring, setMonitoring] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.getCallStats(),
        api.getCallRecordings(filter ? { status: filter } : undefined),
      ]);
      setStats(s);
      setCalls(c);
    } catch (e) {
      console.error('Calls load error:', e);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const viewDetail = async (callId: string) => {
    try {
      const d = await api.getCallDetail(callId);
      setDetail(d);
    } catch (e) {
      console.error('Call detail error:', e);
    }
  };

  const handleTranscribe = async (callId: string) => {
    setTranscribing(callId);
    try {
      const { transcript } = await api.transcribeCall(callId);
      if (detail?.call_id === callId) {
        setDetail({ ...detail, transcript, has_transcript: true } as CallDetail);
      }
      await loadData();
    } catch (e) {
      console.error('Transcription error:', e);
    }
    setTranscribing('');
  };

  const handleMonitor = async (callId: string) => {
    try {
      const result = await api.monitorCall(callId);
      setMonitoring(callId);
      alert(`Escuchando llamada a ext ${result.agentExtension}\nSIP URI: ${result.sipUri}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleStopMonitor = async (callId: string) => {
    try {
      await api.stopMonitorCall(callId);
      setMonitoring('');
    } catch (e) {
      console.error('Stop monitor error:', e);
    }
  };

  const formatDuration = (s: number | null) => {
    if (!s) return '-';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          <StatCard label="Total (30d)" value={stats.total_calls} color="#64748B" />
          <StatCard label="En curso" value={stats.active_calls} color="#059669" />
          <StatCard label="Completadas" value={stats.completed_calls} color="#3B82F6" />
          <StatCard label="Fallidas" value={stats.failed_calls} color="#EF4444" />
          <StatCard label="Grabadas" value={stats.recorded_calls} color="#8B5CF6" />
          <StatCard label="Transcritas" value={stats.transcribed_calls} color="#06B6D4" />
          <StatCard label="Duracion media" value={formatDuration(Math.round(Number(stats.avg_duration)))} color="#F59E0B" />
          <StatCard label="Almacenamiento" value={formatBytes(Number(stats.total_storage_bytes))} color="#64748B" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectStyle}>
          <option value="">Todas</option>
          <option value="active">En curso</option>
          <option value="ended">Finalizadas</option>
          <option value="transferred">Transferidas</option>
          <option value="failed">Fallidas</option>
          <option value="missed">Perdidas</option>
        </select>
        <button onClick={loadData} style={btnSecondary}>Actualizar</button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Call list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--rd-surface)', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : calls.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 48, color: 'var(--rd-text-secondary)',
              borderRadius: 12, border: '1px dashed var(--rd-border)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No hay llamadas registradas</div>
            </div>
          ) : (
            calls.map((c) => {
              const st = STATUS_LABELS[c.status] || STATUS_LABELS.ended;
              const isActive = detail?.call_id === c.call_id;
              return (
                <div
                  key={c.id}
                  onClick={() => viewDetail(c.call_id)}
                  style={{
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${isActive ? 'var(--rd-primary)' : 'var(--rd-border)'}`,
                    background: isActive ? 'var(--rd-primary-light, #EFF6FF)' : 'var(--rd-surface)',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 15 }}>&#x1F4DE;</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--rd-text)' }}>
                        {c.visitor_phone || 'Desconocido'}
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: st.bg, color: st.color,
                      }}>
                        {st.label}
                      </span>
                      {c.business_line && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                          background: (LINE_COLORS[c.business_line] || '#64748B') + '20',
                          color: LINE_COLORS[c.business_line] || '#64748B',
                          textTransform: 'uppercase',
                        }}>
                          {c.business_line}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--rd-text-secondary)', display: 'flex', gap: 12 }}>
                      <span>Ext: {c.agent_extension || '-'}</span>
                      <span>{formatDuration(c.duration_seconds)}</span>
                      <span>{formatDate(c.started_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {c.recording_url && <IconBadge title="Grabada" color="#8B5CF6">&#x1F3A4;</IconBadge>}
                    {c.has_transcript && <IconBadge title="Transcrita" color="#06B6D4">&#x1F4DD;</IconBadge>}
                    {c.monitored_by && <IconBadge title="Monitorizada" color="#DC2626">&#x1F441;</IconBadge>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {detail && (
          <div style={{
            width: 400, flexShrink: 0, borderRadius: 12, border: '1px solid var(--rd-border)',
            background: 'var(--rd-surface)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
            maxHeight: 600, overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--rd-text)', margin: 0 }}>
                Detalle de llamada
              </h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--rd-text-secondary)' }}>
                &#x2715;
              </button>
            </div>

            <InfoRow label="Telefono" value={detail.visitor_phone || '-'} />
            <InfoRow label="Extension agente" value={detail.agent_extension || '-'} />
            <InfoRow label="Linea de negocio" value={detail.business_line || '-'} />
            <InfoRow label="Estado" value={STATUS_LABELS[detail.status]?.label || detail.status} />
            <InfoRow label="Duracion" value={formatDuration(detail.duration_seconds)} />
            <InfoRow label="Inicio" value={detail.started_at ? formatDate(detail.started_at) : '-'} />
            <InfoRow label="Fin" value={detail.ended_at ? formatDate(detail.ended_at) : '-'} />
            {detail.file_size_bytes && <InfoRow label="Tamano grabacion" value={formatBytes(detail.file_size_bytes)} />}

            {/* Recording player */}
            {detail.recording_url && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 6 }}>
                  Grabacion
                </div>
                <audio controls style={{ width: '100%' }} src={detail.recording_url} />
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.recording_url && !detail.transcript && (
                <button
                  onClick={() => handleTranscribe(detail.call_id)}
                  disabled={transcribing === detail.call_id}
                  style={btnPrimary}
                >
                  {transcribing === detail.call_id ? 'Transcribiendo...' : 'Transcribir'}
                </button>
              )}
              {detail.status === 'active' && (
                monitoring === detail.call_id ? (
                  <button onClick={() => handleStopMonitor(detail.call_id)} style={{ ...btnSecondary, color: '#DC2626', borderColor: '#DC2626' }}>
                    Dejar de escuchar
                  </button>
                ) : (
                  <button onClick={() => handleMonitor(detail.call_id)} style={{ ...btnSecondary, color: '#7C3AED', borderColor: '#7C3AED' }}>
                    &#x1F441; Escuchar llamada
                  </button>
                )
              )}
            </div>

            {/* Transcript */}
            {detail.transcript && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rd-text-secondary)', marginBottom: 6 }}>
                  Transcripcion
                  {detail.transcribed_at && (
                    <span style={{ fontWeight: 400, marginLeft: 8 }}>{formatDate(detail.transcribed_at)}</span>
                  )}
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: 'var(--rd-bg, #fff)', border: '1px solid var(--rd-border)',
                  whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto',
                  color: 'var(--rd-text)',
                }}>
                  {detail.transcript}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12, border: '1px solid var(--rd-border)', background: 'var(--rd-surface)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--rd-text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function IconBadge({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <span title={title} style={{
      width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: color + '15', fontSize: 12,
    }}>
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--rd-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--rd-text)' }}>{value}</span>
    </div>
  );
}

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
