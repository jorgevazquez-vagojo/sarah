import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───

interface TodayStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  totalChats: number;
  resolvedChats: number;
  escalatedChats: number;
  leads: number;
  callbacks: number;
  avgCsat: number;
  avgWaitTime: number;
  avgCallDuration: number;
  avgChatResponseTime: number;
  conversionRate: number;
}

interface GlobalMetrics {
  activeCalls: number;
  activeChats: number;
  inQueue: number;
  agentsOnline: number;
  agentsTotal: number;
  slaPercent: number;
  slaTarget: number;
  todayStats: TodayStats;
}

interface QueueData {
  name: string;
  label: string;
  emoji: string;
  color: string;
  activeCalls: number;
  activeChats: number;
  inQueue: number;
  agentsOnline: number;
  avgWaitTime: number;
  slaPercent: number;
}

interface AgentData {
  id: string;
  name: string;
  status: string;
  businessLine: string;
  businessLines: string[];
  currentCall: { callId: string; duration: number } | null;
  avgCsat: number;
  todayCalls: number;
  todayChats: number;
}

interface AlertData {
  level: string;
  message: string;
  queue: string;
  timestamp: string;
}

interface HourlyData {
  hour: string;
  calls: number;
  chats: number;
}

interface WallboardData {
  timestamp: string;
  global: GlobalMetrics;
  queues: QueueData[];
  agents: AgentData[];
  alerts: AlertData[];
  hourlyVolume: HourlyData[];
}

// ─── Constants ───

const BU_COLORS: Record<string, string> = {
  boostic: '#10B981',
  binnacle: '#6366F1',
  marketing: '#F59E0B',
  tech: '#3B82F6',
  general: '#94A3B8',
};

const STATUS_COLORS: Record<string, string> = {
  online: '#10B981',
  on_call: '#10B981',
  busy: '#10B981',
  away: '#F59E0B',
  paused: '#F59E0B',
  offline: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Disponible',
  on_call: 'En llamada',
  busy: 'Ocupado',
  away: 'Ausente',
  paused: 'Pausado',
  offline: 'Desconectado',
};

const POLL_INTERVAL = 10000; // HTTP fallback: 10 seconds
const WS_PUSH_INTERVAL = 5000; // Server pushes every 5 seconds
const VIEW_ROTATION_INTERVAL = 30000; // Auto-rotate every 30 seconds

// ─── Utility functions ───

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── AnimatedNumber component ───

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    const duration = 600;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplayed(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <>{decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed)}</>;
}

// ─── SLA Bar ───

function SLABar({ percent, target }: { percent: number; target: number }) {
  const isAtRisk = percent < target;
  const barColor = isAtRisk ? '#EF4444' : percent >= 90 ? '#10B981' : '#F59E0B';

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-3xl font-black tracking-tight" style={{ color: barColor }}>
          <AnimatedNumber value={percent} />%
        </span>
        <span className="text-xs opacity-50">Objetivo: {target}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: barColor,
            boxShadow: `0 0 8px ${barColor}60`,
          }}
        />
      </div>
      {/* Target marker */}
      <div className="relative w-full h-0">
        <div
          className="absolute -top-2 w-px h-2"
          style={{ left: `${target}%`, background: 'rgba(255,255,255,0.4)' }}
        />
      </div>
    </div>
  );
}

// ─── Sparkline (SVG) ───

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const width = 200;
  const padding = 2;
  const effectiveHeight = height - padding * 2;

  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = padding + effectiveHeight - (v / max) * effectiveHeight;
    return `${x},${y}`;
  });

  const areaPoints = [
    `0,${height}`,
    ...points,
    `${width},${height}`,
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-grad-${color.replace('#', '')})`}
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Mini bar chart for hourly volume ───

function HourlyChart({ data }: { data: HourlyData[] }) {
  if (data.length === 0) return <div className="text-xs opacity-40">Sin datos</div>;
  const maxVal = Math.max(...data.map((d) => d.calls + d.chats), 1);

  return (
    <div className="flex items-end gap-px h-16 w-full">
      {data.map((d, i) => {
        const totalHeight = ((d.calls + d.chats) / maxVal) * 100;
        const callHeight = totalHeight > 0 ? (d.calls / (d.calls + d.chats)) * totalHeight : 0;
        const chatHeight = totalHeight - callHeight;
        return (
          <div key={i} className="flex-1 flex flex-col justify-end items-stretch" title={`${d.hour} — ${d.calls} calls, ${d.chats} chats`}>
            <div
              className="rounded-t-sm transition-all duration-500"
              style={{ height: `${chatHeight}%`, background: '#3B82F6', minHeight: chatHeight > 0 ? 2 : 0 }}
            />
            <div
              className="transition-all duration-500"
              style={{ height: `${callHeight}%`, background: '#10B981', minHeight: callHeight > 0 ? 2 : 0 }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Agent status dot ───

function StatusDot({ status, size = 10 }: { status: string; size?: number }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const isActive = status === 'online' || status === 'on_call' || status === 'busy';

  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: isActive ? `0 0 6px ${color}80` : 'none',
        animation: isActive ? 'wb-pulse 2s ease-in-out infinite' : 'none',
      }}
    />
  );
}

// ─── KPI Card ───

function KPICard({ label, value, icon, color, subtitle }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="wb-card flex flex-col justify-between p-5 xl:p-6">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-50">{label}</span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}15` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div>
        <div className="text-4xl xl:text-5xl font-black tracking-tight" style={{ color }}>
          <AnimatedNumber value={value} />
        </div>
        {subtitle && <p className="text-xs mt-1 opacity-40">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── BU Card ───

function BUCard({ queue }: { queue: QueueData }) {
  const total = queue.activeCalls + queue.activeChats + queue.inQueue;
  return (
    <div className="wb-card p-4 xl:p-5" style={{ borderLeft: `3px solid ${queue.color}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{queue.emoji}</span>
        <span className="text-sm font-bold truncate">{queue.name.charAt(0).toUpperCase() + queue.name.slice(1)}</span>
        <span
          className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${queue.color}20`, color: queue.color }}
        >
          {queue.agentsOnline} agentes
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl xl:text-2xl font-black" style={{ color: '#10B981' }}>
            <AnimatedNumber value={queue.activeCalls} />
          </div>
          <div className="text-[10px] opacity-40 uppercase tracking-wider">Llamadas</div>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-black" style={{ color: '#3B82F6' }}>
            <AnimatedNumber value={queue.activeChats} />
          </div>
          <div className="text-[10px] opacity-40 uppercase tracking-wider">Chats</div>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-black" style={{ color: queue.inQueue > 0 ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}>
            <AnimatedNumber value={queue.inQueue} />
          </div>
          <div className="text-[10px] opacity-40 uppercase tracking-wider">En cola</div>
        </div>
      </div>
      {total === 0 && (
        <div className="text-[10px] text-center mt-2 opacity-30">Sin actividad</div>
      )}
    </div>
  );
}

// ─── Alert Ticker ───

function AlertTicker({ alerts }: { alerts: AlertData[] }) {
  if (alerts.length === 0) return null;

  const hasDanger = alerts.some((a) => a.level === 'danger');

  return (
    <div
      className="overflow-hidden whitespace-nowrap"
      style={{
        background: hasDanger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)',
        borderTop: `1px solid ${hasDanger ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`,
      }}
    >
      <div className="wb-ticker-scroll inline-flex items-center gap-8 py-2 px-4">
        {[...alerts, ...alerts].map((alert, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs font-medium shrink-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: alert.level === 'danger' ? '#EF4444' : '#F59E0B' }}
            />
            <span style={{ color: alert.level === 'danger' ? '#FCA5A5' : '#FDE68A' }}>
              {alert.message}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Icons (inline SVG) ───

const Icons = {
  phone: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  queue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  maximize: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  minimize: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
};

// ─── Main Wallboard Component ───

export function Wallboard() {
  const [data, setData] = useState<WallboardData | null>(null);
  const [clock, setClock] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'global' | 'detail'>('global');
  const [autoRotate, setAutoRotate] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<number>(0);
  const rotateTimerRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clock tick
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data via HTTP
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        setError('No token found. Please log in first.');
        return;
      }
      const res = await fetch('/api/wallboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please log in again.');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Connection error');
    }
  }, []);

  // WebSocket connection for live updates
  useEffect(() => {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    let reconnectTimer: number;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/agent?token=${token}&role=wallboard`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Stop HTTP polling when WS connected
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = 0;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'wallboard_update' && msg.data) {
            setData(msg.data);
            setLastUpdate(new Date());
            setError(null);
          }
        } catch {
          // Ignore non-wallboard messages
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setWsConnected(false);
        // Start HTTP polling as fallback
        if (!pollTimerRef.current) {
          pollTimerRef.current = window.setInterval(fetchData, POLL_INTERVAL);
        }
        reconnectTimer = window.setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        // Will trigger onclose
      };
    };

    // Initial fetch + connect WS
    fetchData();
    connect();

    // Start polling as fallback until WS connects
    pollTimerRef.current = window.setInterval(fetchData, POLL_INTERVAL);

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimer);
      clearInterval(pollTimerRef.current);
      wsRef.current?.close();
    };
  }, [fetchData]);

  // Auto-rotate views
  useEffect(() => {
    if (autoRotate) {
      rotateTimerRef.current = window.setInterval(() => {
        setViewMode((v) => (v === 'global' ? 'detail' : 'global'));
      }, VIEW_ROTATION_INTERVAL);
    }
    return () => clearInterval(rotateTimerRef.current);
  }, [autoRotate]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for F11
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen]);

  // Fullscreen change event
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Render ───

  const g = data?.global;
  const ts = data?.global?.todayStats;

  return (
    <div ref={containerRef} className="wb-root">
      {/* ─── Top Bar ─── */}
      <header className="wb-header">
        <div className="flex items-center gap-3">
          <div className="wb-logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">Redegal Contact Center</h1>
            <p className="text-[10px] opacity-40 font-medium">Wallboard en tiempo real</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: wsConnected ? '#10B981' : error ? '#EF4444' : '#F59E0B',
                boxShadow: wsConnected ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                animation: wsConnected ? 'wb-pulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: wsConnected ? '#10B981' : '#F59E0B' }}>
              {wsConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="wb-pill-group">
            <button
              className={`wb-pill ${viewMode === 'global' ? 'active' : ''}`}
              onClick={() => setViewMode('global')}
            >
              Global
            </button>
            <button
              className={`wb-pill ${viewMode === 'detail' ? 'active' : ''}`}
              onClick={() => setViewMode('detail')}
            >
              Detalle
            </button>
          </div>

          {/* Auto-rotate */}
          <button
            className={`wb-btn-icon ${autoRotate ? 'active' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Detener auto-rotacion' : 'Auto-rotar vistas (30s)'}
          >
            {Icons.refresh}
          </button>

          {/* Fullscreen */}
          <button
            className="wb-btn-icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (F11)'}
          >
            {isFullscreen ? Icons.minimize : Icons.maximize}
          </button>

          {/* Clock */}
          <div className="text-right ml-2">
            <div className="text-xl font-mono font-bold tracking-wider">{formatTime(clock)}</div>
            <div className="text-[10px] opacity-40 font-medium">
              {clock.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Error state ─── */}
      {error && !data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-20">!</div>
            <p className="text-lg font-semibold opacity-60">{error}</p>
            <button onClick={fetchData} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ─── Loading state ─── */}
      {!data && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="wb-spinner mx-auto mb-4" />
            <p className="text-sm opacity-40">Cargando metricas...</p>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      {data && g && ts && (
        <div className="flex-1 overflow-auto p-4 xl:p-6 wb-content">
          {viewMode === 'global' ? (
            <>
              {/* Row 1: Big KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 mb-4 xl:mb-5">
                <KPICard
                  label="Llamadas activas"
                  value={g.activeCalls}
                  icon={Icons.phone}
                  color="#10B981"
                  subtitle={`${ts.totalCalls} hoy (${ts.missedCalls} perdidas)`}
                />
                <KPICard
                  label="En cola"
                  value={g.inQueue}
                  icon={Icons.queue}
                  color={g.inQueue > 3 ? '#EF4444' : g.inQueue > 0 ? '#F59E0B' : '#94A3B8'}
                  subtitle={`Espera media: ${ts.avgWaitTime}s`}
                />
                <KPICard
                  label="Agentes online"
                  value={g.agentsOnline}
                  icon={Icons.users}
                  color="#3B82F6"
                  subtitle={`${g.agentsTotal} registrados`}
                />
                <div className="wb-card flex flex-col justify-between p-5 xl:p-6">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-50">SLA</span>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.1)' }}>
                      <div style={{ color: '#8B5CF6' }}>{Icons.shield}</div>
                    </div>
                  </div>
                  <SLABar percent={g.slaPercent} target={g.slaTarget} />
                </div>
              </div>

              {/* Row 2: BU cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 mb-4 xl:mb-5">
                {data.queues.map((q) => (
                  <BUCard key={q.name} queue={q} />
                ))}
              </div>

              {/* Row 3: Agent table + Today stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-5 mb-4 xl:mb-5">
                {/* Agent table */}
                <div className="lg:col-span-2 wb-card overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-50">Agentes</span>
                    <span className="text-xs opacity-30">{data.agents.length} activos</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <th className="wb-th text-left pl-5">Agente</th>
                          <th className="wb-th text-left">Estado</th>
                          <th className="wb-th text-left">Linea</th>
                          <th className="wb-th text-center">Actividad</th>
                          <th className="wb-th text-center">Llamadas</th>
                          <th className="wb-th text-center">Chats</th>
                          <th className="wb-th text-center pr-5">CSAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.agents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-xs opacity-30">
                              Sin agentes conectados
                            </td>
                          </tr>
                        ) : (
                          data.agents.map((agent) => (
                            <tr key={agent.id} className="wb-row">
                              <td className="wb-td pl-5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                                    style={{ background: `${BU_COLORS[agent.businessLine] || BU_COLORS.general}20`, color: BU_COLORS[agent.businessLine] || BU_COLORS.general }}
                                  >
                                    {agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span className="text-xs font-semibold truncate">{agent.name}</span>
                                </div>
                              </td>
                              <td className="wb-td">
                                <div className="flex items-center gap-1.5">
                                  <StatusDot status={agent.status} size={8} />
                                  <span className="text-xs">{STATUS_LABELS[agent.status] || agent.status}</span>
                                </div>
                              </td>
                              <td className="wb-td">
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{
                                    background: `${BU_COLORS[agent.businessLine] || BU_COLORS.general}15`,
                                    color: BU_COLORS[agent.businessLine] || BU_COLORS.general,
                                  }}
                                >
                                  {agent.businessLine}
                                </span>
                              </td>
                              <td className="wb-td text-center">
                                {agent.currentCall ? (
                                  <span className="text-xs font-mono" style={{ color: '#10B981' }}>
                                    {formatDuration(agent.currentCall.duration)}
                                  </span>
                                ) : (
                                  <span className="text-xs opacity-30">-</span>
                                )}
                              </td>
                              <td className="wb-td text-center text-xs font-semibold">{agent.todayCalls}</td>
                              <td className="wb-td text-center text-xs font-semibold">{agent.todayChats}</td>
                              <td className="wb-td text-center pr-5">
                                {agent.avgCsat > 0 ? (
                                  <span className="text-xs font-semibold" style={{ color: agent.avgCsat >= 4 ? '#10B981' : agent.avgCsat >= 3 ? '#F59E0B' : '#EF4444' }}>
                                    {agent.avgCsat.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-xs opacity-30">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Today's stats */}
                <div className="wb-card p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-50">Hoy</span>
                  <div className="mt-4 space-y-4">
                    {/* Calls */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                        <span className="text-xs font-semibold opacity-60">Llamadas</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-lg font-black"><AnimatedNumber value={ts.totalCalls} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: '#10B981' }}><AnimatedNumber value={ts.answeredCalls} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Contestadas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: ts.missedCalls > 0 ? '#EF4444' : 'inherit' }}><AnimatedNumber value={ts.missedCalls} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Perdidas</div>
                        </div>
                      </div>
                    </div>

                    {/* Chats */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: '#3B82F6' }} />
                        <span className="text-xs font-semibold opacity-60">Chats</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-lg font-black"><AnimatedNumber value={ts.totalChats} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: '#10B981' }}><AnimatedNumber value={ts.resolvedChats} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Resueltos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: ts.escalatedChats > 0 ? '#F59E0B' : 'inherit' }}><AnimatedNumber value={ts.escalatedChats} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Escalados</div>
                        </div>
                      </div>
                    </div>

                    {/* Leads & Performance */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: '#8B5CF6' }} />
                        <span className="text-xs font-semibold opacity-60">Conversion</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: '#8B5CF6' }}><AnimatedNumber value={ts.leads} /></div>
                          <div className="text-[9px] opacity-30 uppercase">Leads</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black"><AnimatedNumber value={ts.conversionRate} decimals={1} />%</div>
                          <div className="text-[9px] opacity-30 uppercase">Conv. Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-black" style={{ color: ts.avgCsat >= 4 ? '#10B981' : '#F59E0B' }}>
                            {ts.avgCsat > 0 ? <><AnimatedNumber value={ts.avgCsat} decimals={1} /></> : '-'}
                          </div>
                          <div className="text-[9px] opacity-30 uppercase">CSAT</div>
                        </div>
                      </div>
                    </div>

                    {/* Response times */}
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[9px] opacity-30 uppercase mb-1">Resp. Media Chat</div>
                          <div className="text-sm font-bold">{ts.avgChatResponseTime}s</div>
                        </div>
                        <div>
                          <div className="text-[9px] opacity-30 uppercase mb-1">Dur. Media Llamada</div>
                          <div className="text-sm font-bold">{formatDuration(ts.avgCallDuration)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Hourly volume */}
              <div className="wb-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-50">Volumen por hora (ultimas 24h)</span>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ background: '#10B981' }} />
                      Llamadas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ background: '#3B82F6' }} />
                      Chats
                    </span>
                  </div>
                </div>
                <HourlyChart data={data.hourlyVolume} />
                <div className="flex justify-between mt-1 text-[9px] opacity-20">
                  {data.hourlyVolume.filter((_, i) => i % 4 === 0).map((d) => (
                    <span key={d.hour}>{d.hour}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ─── Detail View: per-BU breakdown ─── */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5">
              {data.queues.map((queue) => {
                const buAgents = data.agents.filter(
                  (a) => a.businessLines?.includes(queue.name) || a.businessLine === queue.name
                );
                const buVolume = data.hourlyVolume.map((h) => h.calls + h.chats);

                return (
                  <div key={queue.name} className="wb-card overflow-hidden">
                    {/* BU Header */}
                    <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `2px solid ${queue.color}` }}>
                      <span className="text-2xl">{queue.emoji}</span>
                      <div className="flex-1">
                        <h2 className="text-base font-bold">{queue.label}</h2>
                        <p className="text-[10px] opacity-40">{buAgents.length} agentes asignados</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black" style={{ color: queue.color }}>
                          {queue.activeCalls + queue.activeChats + queue.inQueue}
                        </div>
                        <div className="text-[9px] opacity-30 uppercase">Activos</div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-1 p-4">
                      <div className="text-center">
                        <div className="text-xl font-black" style={{ color: '#10B981' }}>{queue.activeCalls}</div>
                        <div className="text-[9px] opacity-30 uppercase">Llamadas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-black" style={{ color: '#3B82F6' }}>{queue.activeChats}</div>
                        <div className="text-[9px] opacity-30 uppercase">Chats</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-black" style={{ color: queue.inQueue > 0 ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}>{queue.inQueue}</div>
                        <div className="text-[9px] opacity-30 uppercase">En cola</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-black">{queue.agentsOnline}</div>
                        <div className="text-[9px] opacity-30 uppercase">Agentes</div>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="px-4 pb-2">
                      <Sparkline data={buVolume} color={queue.color} height={32} />
                    </div>

                    {/* Agents list */}
                    <div className="px-4 pb-4">
                      {buAgents.length === 0 ? (
                        <p className="text-[10px] opacity-20 text-center py-2">Sin agentes</p>
                      ) : (
                        <div className="space-y-1">
                          {buAgents.map((agent) => (
                            <div key={agent.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <StatusDot status={agent.status} size={7} />
                              <span className="text-xs font-medium flex-1 truncate">{agent.name}</span>
                              {agent.currentCall && (
                                <span className="text-[10px] font-mono" style={{ color: '#10B981' }}>
                                  {formatDuration(agent.currentCall.duration)}
                                </span>
                              )}
                              <span className="text-[10px] opacity-30">{agent.todayCalls}c / {agent.todayChats}ch</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Alert Ticker (bottom) ─── */}
      {data && data.alerts.length > 0 && (
        <AlertTicker alerts={data.alerts} />
      )}

      {/* ─── Bottom status bar ─── */}
      <footer className="wb-footer">
        <span className="opacity-30 text-[10px]">
          Ultima actualizacion: {lastUpdate ? formatTime(lastUpdate) : '-'}
        </span>
        <span className="opacity-20 text-[10px]">
          {wsConnected ? 'WebSocket' : 'HTTP Polling'} | {data?.agents?.length || 0} agentes
        </span>
      </footer>
    </div>
  );
}
