import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

type SettingsTab = 'canned' | 'webhooks' | 'theme' | 'system';

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  language: string;
  business_line?: string;
  category?: string;
  usage_count: number;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  failure_count: number;
  last_triggered_at?: string;
}

const TABS: { id: SettingsTab; label: string; icon: string; desc: string }[] = [
  { id: 'canned', label: 'Respuestas rapidas', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', desc: 'Atajos de texto' },
  { id: 'webhooks', label: 'Webhooks', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', desc: 'HTTP callbacks' },
  { id: 'theme', label: 'Apariencia', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', desc: 'Colores del widget' },
  { id: 'system', label: 'Sistema', icon: 'M22 12h-4l-3 9L9 3l-3 9H2', desc: 'Estado y servicios' },
];

const WEBHOOK_EVENTS = [
  'conversation.started', 'conversation.closed', 'message.received', 'message.sent',
  'lead.created', 'lead.updated', 'agent.assigned', 'call.started', 'call.ended', 'csat.submitted',
];

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>('canned');

  return (
    <div className="flex h-full animate-fade-in">
      {/* Settings sidebar */}
      <div className="w-60 py-4 px-3 shrink-0"
        style={{ background: 'var(--rd-surface)', borderRight: '1px solid var(--rd-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-3"
          style={{ color: 'var(--rd-text-muted)' }}>Configuracion</p>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`sidebar-link w-full mb-0.5 ${tab === t.id ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d={t.icon} />
            </svg>
            <div className="flex-1 text-left min-w-0">
              <span className="text-xs block truncate">{t.label}</span>
              <span className="text-[10px] block truncate" style={{ color: 'var(--rd-text-muted)' }}>{t.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'canned' && <CannedResponsesPanel />}
        {tab === 'webhooks' && <WebhooksPanel />}
        {tab === 'theme' && <ThemePanel />}
        {tab === 'system' && <SystemPanel />}
      </div>
    </div>
  );
}

// ─── Canned Responses ───
function CannedResponsesPanel() {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shortcut: '', title: '', content: '', language: 'es', businessLine: '', category: '' });

  useEffect(() => {
    api.getCannedResponses().then(setResponses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.shortcut || !form.title || !form.content) return;
    const resp = await api.createCannedResponse(form);
    setResponses((prev) => [resp, ...prev]);
    setForm({ shortcut: '', title: '', content: '', language: 'es', businessLine: '', category: '' });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteCannedResponse(id);
    setResponses((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--rd-text)' }}>Respuestas rapidas</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>
            Atajos de texto para responder mas rapido. Usa /atajo en el chat.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nueva respuesta
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-5 mb-5 animate-scale-in"
          style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Atajo *</label>
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--rd-text-muted)' }}>/</span>
                <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} className="input-field" placeholder="saludo" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Titulo *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Saludo inicial" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Categoria</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="general" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Idioma</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="input-field">
                {['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'zh', 'ja', 'ko', 'ar', 'gl'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Linea de negocio</label>
              <select value={form.businessLine} onChange={(e) => setForm({ ...form, businessLine: e.target.value })} className="input-field">
                <option value="">Todas</option>
                <option value="boostic">Boostic</option>
                <option value="binnacle">Binnacle</option>
                <option value="marketing">Marketing</option>
                <option value="tech">Tech</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Contenido *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="input-field min-h-[80px] resize-y"
              placeholder="Hola, gracias por contactar con Redegal..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary text-xs" disabled={!form.shortcut || !form.title || !form.content}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
              <div className="skeleton h-4 w-48 mb-2" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      ) : responses.length === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="1.5" className="mx-auto mb-3 opacity-30">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--rd-text-secondary)' }}>No hay respuestas rapidas</p>
          <p className="text-xs mt-1" style={{ color: 'var(--rd-text-muted)' }}>Crea una para empezar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map((resp) => (
            <div key={resp.id} className="rounded-xl p-4 flex items-start gap-3 transition-all"
              style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}>
                    /{resp.shortcut}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--rd-text)' }}>{resp.title}</span>
                  <span className="badge badge-gray">{resp.language.toUpperCase()}</span>
                  {resp.business_line && <span className="badge badge-blue">{resp.business_line}</span>}
                </div>
                <p className="text-xs line-clamp-2" style={{ color: 'var(--rd-text-secondary)' }}>{resp.content}</p>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--rd-text-muted)' }}>
                  Usado {resp.usage_count} {resp.usage_count === 1 ? 'vez' : 'veces'}
                </p>
              </div>
              <button onClick={() => handleDelete(resp.id)} className="btn-ghost text-xs hover:!text-red-500 hover:!bg-red-50 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Webhooks ───
function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] as string[], secret: '' });

  useEffect(() => {
    api.getWebhooks().then(setWebhooks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = async () => {
    if (!form.url || !form.events.length) return;
    const webhook = await api.createWebhook(form);
    setWebhooks((prev) => [webhook, ...prev]);
    setForm({ url: '', events: [], secret: '' });
    setShowForm(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--rd-text)' }}>Webhooks</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>
            Notificaciones HTTP firmadas con HMAC a sistemas externos
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nuevo webhook
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-5 mb-5 animate-scale-in"
          style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>URL *</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="input-field" placeholder="https://api.example.com/webhook" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--rd-text-secondary)' }}>Secret (HMAC)</label>
              <input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className="input-field" placeholder="opcional" type="password" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--rd-text-secondary)' }}>Eventos *</label>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className="px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-all"
                  style={form.events.includes(event)
                    ? { background: 'linear-gradient(135deg, var(--rd-primary), var(--rd-primary-dark))', color: 'white' }
                    : { background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }
                  }
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary text-xs" disabled={!form.url || !form.events.length}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
              <div className="skeleton h-4 w-64 mb-2" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="1.5" className="mx-auto mb-3 opacity-30">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--rd-text-secondary)' }}>No hay webhooks configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl p-4 transition-all"
              style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${wh.is_active ? 'bg-emerald-500 animate-pulse-dot' : 'bg-slate-400'}`} />
                  <span className="text-sm font-medium font-mono" style={{ color: 'var(--rd-text)' }}>{wh.url}</span>
                </div>
                {wh.failure_count > 0 && (
                  <span className="badge badge-red">{wh.failure_count} fallos</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {wh.events.map((e) => (
                  <span key={e} className="badge badge-gray">{e}</span>
                ))}
              </div>
              {wh.last_triggered_at && (
                <p className="text-[10px]" style={{ color: 'var(--rd-text-muted)' }}>
                  Ultimo disparo: {new Date(wh.last_triggered_at).toLocaleString('es-ES')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Theme ───
function ThemePanel() {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    api.getThemes().then(setThemes).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    await api.updateTheme(editing.id, editing.config);
    setThemes((prev) => prev.map((t) => (t.id === editing.id ? editing : t)));
    setEditing(null);
  };

  const updateColor = (key: string, value: string) => {
    setEditing((prev: any) => ({
      ...prev,
      config: {
        ...prev.config,
        colors: { ...prev.config.colors, [key]: value },
      },
    }));
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}</div>;

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--rd-text)' }}>Apariencia del widget</h2>
      <p className="text-xs mb-6" style={{ color: 'var(--rd-text-muted)' }}>
        Personaliza colores, tipografia y layout del widget por tenant
      </p>

      {themes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--rd-text-muted)' }}>No hay temas configurados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {themes.map((theme) => {
            const isEditing = editing?.id === theme.id;
            const config = isEditing ? editing.config : theme.config;
            if (!config) return null;

            return (
              <div key={theme.id} className="rounded-2xl p-5"
                style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl" style={{ background: `linear-gradient(135deg, ${config.colors?.primary || '#E30613'}, ${config.colors?.primaryDark || '#B8050F'})` }} />
                    <div>
                      <span className="text-sm font-bold" style={{ color: 'var(--rd-text)' }}>{theme.name}</span>
                      <span className="badge badge-gray ml-2">{theme.tenant_slug}</span>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancelar</button>
                      <button onClick={handleSave} className="btn-primary text-xs">Guardar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditing({ ...theme })} className="btn-secondary text-xs">Editar</button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { key: 'primary', label: 'Primario' },
                    { key: 'primaryDark', label: 'Primario oscuro' },
                    { key: 'secondary', label: 'Secundario' },
                    { key: 'accent', label: 'Acento' },
                    { key: 'background', label: 'Fondo' },
                    { key: 'surface', label: 'Superficie' },
                    { key: 'text', label: 'Texto' },
                    { key: 'success', label: 'Exito' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={config.colors?.[key] || '#000000'}
                        onChange={(e) => updateColor(key, e.target.value)}
                        disabled={!isEditing}
                        className="w-9 h-9 rounded-lg border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--rd-border)' }}
                      />
                      <div>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--rd-text-secondary)' }}>{label}</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--rd-text-muted)' }}>{config.colors?.[key]}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                <div className="mt-5 p-4 rounded-xl" style={{ background: 'var(--rd-bg)', border: '1px solid var(--rd-border)' }}>
                  <p className="text-[10px] font-medium mb-3" style={{ color: 'var(--rd-text-muted)' }}>Vista previa</p>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${config.colors?.primary || '#E30613'}, ${config.colors?.primaryDark || '#B8050F'})` }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="rounded-xl px-4 py-2.5 text-white text-xs font-medium mb-1"
                        style={{ background: config.colors?.primary || '#E30613', display: 'inline-block' }}>
                        {config.branding?.companyName || 'Redegal'}
                      </div>
                      <div className="rounded-xl px-4 py-2.5 text-xs"
                        style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', color: 'var(--rd-text-secondary)', display: 'inline-block' }}>
                        Hola, en que puedo ayudarte?
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── System ───
function SystemPanel() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--rd-text)' }}>Estado del sistema</h2>
      <p className="text-xs mb-6" style={{ color: 'var(--rd-text-muted)' }}>Diagnostico y salud de servicios</p>

      {health ? (
        <div className="space-y-2 mb-6">
          {Object.entries(health).map(([key, val]: [string, any]) => {
            const isOk = val === 'ok' || val === true;
            return (
              <div key={key} className="flex items-center justify-between rounded-xl p-4"
                style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium capitalize" style={{ color: 'var(--rd-text)' }}>{key}</span>
                </div>
                <span className={`text-xs font-semibold ${isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      )}

      {/* CRM Integrations */}
      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--rd-text)' }}>Integraciones CRM</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--rd-text-muted)' }}>
          Configura via tabla <code className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--rd-surface-hover)' }}>config</code> con clave <code className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--rd-surface-hover)' }}>crm_integrations</code>
        </p>
        <div className="grid grid-cols-4 gap-2">
          {['Salesforce', 'HubSpot', 'Zoho CRM', 'Pipedrive'].map((crm) => (
            <div key={crm} className="rounded-xl p-3 text-center"
              style={{ background: 'var(--rd-bg)', border: '1px solid var(--rd-border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--rd-text)' }}>{crm}</p>
              <p className="text-[10px]" style={{ color: 'var(--rd-text-muted)' }}>OAuth 2.0</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plugins */}
      <div className="rounded-xl p-5" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--rd-text)' }}>Plugins disponibles</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--rd-text-muted)' }}>Integracion directa para plataformas e-commerce</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'WordPress', desc: 'Plugin PHP', icon: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z' },
            { name: 'Shopify', desc: 'Liquid snippet', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
            { name: 'Magento 2', desc: 'PHTML template', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
          ].map((p) => (
            <div key={p.name} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'var(--rd-bg)', border: '1px solid var(--rd-border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--rd-surface-hover)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={p.icon} />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--rd-text)' }}>{p.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--rd-text-muted)' }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
