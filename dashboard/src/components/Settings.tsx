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

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'canned', label: 'Respuestas rapidas', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { id: 'webhooks', label: 'Webhooks', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { id: 'theme', label: 'Apariencia', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' },
  { id: 'system', label: 'Sistema', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
];

const WEBHOOK_EVENTS = [
  'conversation.started', 'conversation.closed', 'message.received', 'message.sent',
  'lead.created', 'lead.updated', 'agent.assigned', 'call.started', 'call.ended', 'csat.submitted',
];

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>('canned');

  return (
    <div className="flex h-full animate-fadeIn">
      {/* Settings sidebar */}
      <div className="w-56 bg-white border-r border-slate-200/60 py-4 px-2 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`sidebar-link w-full mb-0.5 ${tab === t.id ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            <span className="text-xs">{t.label}</span>
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Respuestas rapidas</h2>
          <p className="text-xs text-slate-400 mt-0.5">Atajos de texto para responder mas rapido</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
          + Nueva respuesta
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 animate-fadeIn">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Atajo *</label>
              <div className="flex items-center">
                <span className="text-slate-400 mr-1">/</span>
                <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} className="input-field" placeholder="saludo" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titulo *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Saludo inicial" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="general" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="input-field">
                {['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'zh', 'ja', 'ko', 'ar', 'gl'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Linea de negocio</label>
              <select value={form.businessLine} onChange={(e) => setForm({ ...form, businessLine: e.target.value })} className="input-field">
                <option value="">Todas</option>
                <option value="boostic">Boostic</option>
                <option value="binnacle">Binnacle</option>
                <option value="marketing">Marketing</option>
                <option value="tech">Tech</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenido *</label>
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

      {/* List */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>
      ) : responses.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No hay respuestas rapidas</p>
          <p className="text-xs mt-1">Crea una para empezar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map((resp) => (
            <div key={resp.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">/{resp.shortcut}</span>
                  <span className="text-sm font-medium text-slate-700">{resp.title}</span>
                  <span className="badge badge-gray">{resp.language.toUpperCase()}</span>
                  {resp.business_line && <span className="badge badge-blue">{resp.business_line}</span>}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{resp.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">Usado {resp.usage_count} veces</p>
              </div>
              <button onClick={() => handleDelete(resp.id)} className="btn-ghost text-xs text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                Eliminar
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Webhooks</h2>
          <p className="text-xs text-slate-400 mt-0.5">Notificaciones HTTP a sistemas externos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
          + Nuevo webhook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL *</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="input-field" placeholder="https://api.example.com/webhook" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Secret (HMAC)</label>
              <input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className="input-field" placeholder="opcional" type="password" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-2">Eventos *</label>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors ${
                    form.events.includes(event)
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
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

      {/* List */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No hay webhooks configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${wh.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                  <span className="text-sm font-medium text-slate-700 font-mono">{wh.url}</span>
                </div>
                {wh.failure_count > 0 && (
                  <span className="badge badge-red">{wh.failure_count} fallos</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {wh.events.map((e) => (
                  <span key={e} className="badge badge-gray">{e}</span>
                ))}
              </div>
              {wh.last_triggered_at && (
                <p className="text-[10px] text-slate-400">
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

  if (loading) return <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>;

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Apariencia del widget</h2>
      <p className="text-xs text-slate-400 mb-5">Personaliza colores, tipografia y layout del widget</p>

      {themes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No hay temas configurados</p>
      ) : (
        <div className="space-y-3">
          {themes.map((theme) => {
            const isEditing = editing?.id === theme.id;
            const config = isEditing ? editing.config : theme.config;
            if (!config) return null;

            return (
              <div key={theme.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">{theme.name}</span>
                    <span className="badge badge-gray ml-2">{theme.tenant_slug}</span>
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

                {/* Color grid */}
                <div className="grid grid-cols-4 gap-3">
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
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.colors?.[key] || '#000000'}
                        onChange={(e) => updateColor(key, e.target.value)}
                        disabled={!isEditing}
                        className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer disabled:opacity-50"
                      />
                      <div>
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="text-[10px] font-mono text-slate-400">{config.colors?.[key]}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] text-slate-400 mb-2">Vista previa</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${config.colors?.primary || '#E30613'}, ${config.colors?.primaryDark || '#B8050F'})` }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div
                      className="rounded-xl px-4 py-2 text-white text-xs"
                      style={{ backgroundColor: config.colors?.primary || '#E30613' }}
                    >
                      {config.branding?.companyName || 'Redegal'}
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
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Estado del sistema</h2>
      <p className="text-xs text-slate-400 mb-5">Diagnostico y salud de los servicios</p>

      {health ? (
        <div className="space-y-3">
          {Object.entries(health).map(([key, val]: [string, any]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${val === 'ok' || val === true ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-slate-700 capitalize">{key}</span>
              </div>
              <span className={`text-xs font-medium ${val === 'ok' || val === true ? 'text-green-600' : 'text-red-600'}`}>
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>
      )}

      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Integraciones CRM</h3>
        <p className="text-xs text-slate-500 mb-3">
          Configura las integraciones CRM en la tabla <code className="bg-slate-200 px-1 rounded text-[10px]">config</code> con clave <code className="bg-slate-200 px-1 rounded text-[10px]">crm_integrations</code>.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {['Salesforce', 'HubSpot', 'Zoho CRM', 'Pipedrive'].map((crm) => (
            <div key={crm} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
              <p className="text-xs font-medium text-slate-600">{crm}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Via config DB</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Plugins disponibles</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'WordPress', desc: 'Plugin PHP' },
            { name: 'Shopify', desc: 'Liquid snippet' },
            { name: 'Magento 2', desc: 'PHTML template' },
          ].map((p) => (
            <div key={p.name} className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">{p.name}</p>
              <p className="text-[10px] text-slate-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
