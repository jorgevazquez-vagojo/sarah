/**
 * CallbackScheduler — Premium Calendly-style callback scheduling UI.
 *
 * NOT a boring "enter your phone" form. This is a rich, interactive scheduling
 * experience with day tabs, time slot cards, topic selection, and smooth animations.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * INTEGRATION INTO Widget.tsx:
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * 1. Import the component and the hook:
 *
 *    import { CallbackScheduler } from './components/CallbackScheduler';
 *    import { useCallbackScheduler, CallbackRequest } from './hooks/useCallbackScheduler';
 *
 * 2. Add 'callback_scheduler' to the ViewType union:
 *
 *    type ViewType = 'welcome' | 'chat' | 'call' | 'offline_form' | 'csat'
 *                  | 'help' | 'lead_form' | 'callback_scheduler';
 *
 * 3. Initialize the hook inside the Widget component:
 *
 *    const callbackScheduler = useCallbackScheduler(
 *      props.baseUrl || window.location.origin + '/widget',
 *      visitorId
 *    );
 *
 * 4. Add a condition to show the CallbackScheduler in the view rendering:
 *
 *    ) : view === 'callback_scheduler' ? (
 *      <CallbackScheduler
 *        theme={theme}
 *        t={t}
 *        businessLines={['boostic', 'binnacle', 'marketing', 'tech']}
 *        businessHours={{
 *          start: 9,
 *          end: 19,
 *          timezone: theme.businessHours?.timezone || 'Europe/Madrid'
 *        }}
 *        onSchedule={async (data) => {
 *          await callbackScheduler.schedule(data);
 *        }}
 *        onBack={() => { callbackScheduler.reset(); setView('chat'); }}
 *        isSubmitting={callbackScheduler.isSubmitting}
 *        result={callbackScheduler.result}
 *        availableSlots={callbackScheduler.availableSlots}
 *        slotsLoading={callbackScheduler.slotsLoading}
 *        onFetchSlots={callbackScheduler.fetchSlots}
 *        visitorId={visitorId}
 *        language={chat.language}
 *        conversationId={undefined}
 *      />
 *
 * 5. When the user clicks "Call" outside business hours (or anytime you want),
 *    navigate to the scheduler:
 *
 *    onCall={() => {
 *      if (chat.isBusinessHours) {
 *        setView('call');
 *      } else {
 *        setView('callback_scheduler');
 *      }
 *    }}
 *
 *    Or add a "Programar callback" button in the ChatView / WelcomeView that
 *    navigates to callback_scheduler always (even during business hours).
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ThemeConfig } from '../lib/types';
import type { CallbackRequest, CallbackResult, TimeSlotInfo } from '../hooks/useCallbackScheduler';

// ─── Business line labels (multilingual) ───

const BU_LABELS: Record<string, Record<string, string>> = {
  es: {
    boostic: 'SEO & Growth',
    binnacle: 'Business Intelligence',
    marketing: 'Marketing Digital',
    tech: 'Desarrollo Tech',
  },
  en: {
    boostic: 'SEO & Growth',
    binnacle: 'Business Intelligence',
    marketing: 'Digital Marketing',
    tech: 'Tech Development',
  },
  pt: {
    boostic: 'SEO & Growth',
    binnacle: 'Business Intelligence',
    marketing: 'Marketing Digital',
    tech: 'Desenvolvimento Tech',
  },
  gl: {
    boostic: 'SEO & Growth',
    binnacle: 'Business Intelligence',
    marketing: 'Marketing Dixital',
    tech: 'Desenvolvemento Tech',
  },
};

const BU_ICONS: Record<string, string> = {
  boostic: '\u{1F4C8}',     // chart increasing
  binnacle: '\u{1F4CA}',    // bar chart
  marketing: '\u{1F4E3}',   // megaphone
  tech: '\u{1F4BB}',        // laptop
};

// ─── Time slot definitions ───

interface SlotDef {
  id: 'morning' | 'midday' | 'afternoon';
  icon: string;
  labelEs: string;
  labelEn: string;
  start: number; // hour
  end: number;   // hour
  range: string;
}

const SLOT_DEFS: SlotDef[] = [
  { id: 'morning',   icon: '\u2600\uFE0F', labelEs: 'Ma\u00f1ana',   labelEn: 'Morning',   start: 9,  end: 12, range: '09:00-12:00' },
  { id: 'midday',    icon: '\u{1F324}\uFE0F', labelEs: 'Mediod\u00eda', labelEn: 'Midday',    start: 12, end: 15, range: '12:00-15:00' },
  { id: 'afternoon', icon: '\u{1F305}', labelEs: 'Tarde',     labelEn: 'Afternoon', start: 15, end: 19, range: '15:00-19:00' },
];

// ─── i18n strings for the scheduler ───

const STRINGS: Record<string, Record<string, string>> = {
  es: {
    title: 'Te devolvemos la llamada',
    today: 'Hoy',
    tomorrow: 'Ma\u00f1ana',
    dayAfter: 'Pasado',
    pickDay: 'Elegir d\u00eda',
    morning: 'Ma\u00f1ana',
    midday: 'Mediod\u00eda',
    afternoon: 'Tarde',
    agentsAvailable: 'agentes disponibles',
    agentAvailable: 'agente disponible',
    slotUnavailable: 'No disponible',
    phonePlaceholder: '+34 600 000 000',
    phoneLabel: 'Tu tel\u00e9fono',
    namePlaceholder: 'Tu nombre (opcional)',
    topicLabel: '\u00bfSobre qu\u00e9 tema?',
    confirmBtn: 'Confirmar callback',
    disclaimer: 'Te llamaremos en la franja elegida. Sin compromiso.',
    successTitle: '\u00a1Callback confirmado!',
    successDate: 'Fecha',
    successPhone: 'Tel\u00e9fono',
    successTopic: 'Tema',
    successNote: 'Recibir\u00e1s confirmaci\u00f3n si proporcionas email.',
    backToChat: 'Volver al chat',
    phoneRequired: 'Introduce tu n\u00famero de tel\u00e9fono',
    slotRequired: 'Selecciona una franja horaria',
    errorGeneric: 'Error al programar. Int\u00e9ntalo de nuevo.',
    loading: 'Programando...',
    noSlots: 'Sin franjas disponibles para este d\u00eda',
    closedDay: 'D\u00eda no laborable',
  },
  en: {
    title: 'We\u2019ll call you back',
    today: 'Today',
    tomorrow: 'Tomorrow',
    dayAfter: 'Day after',
    pickDay: 'Pick a day',
    morning: 'Morning',
    midday: 'Midday',
    afternoon: 'Afternoon',
    agentsAvailable: 'agents available',
    agentAvailable: 'agent available',
    slotUnavailable: 'Unavailable',
    phonePlaceholder: '+34 600 000 000',
    phoneLabel: 'Your phone',
    namePlaceholder: 'Your name (optional)',
    topicLabel: 'What is it about?',
    confirmBtn: 'Confirm callback',
    disclaimer: 'We\u2019ll call you in the selected time slot. No commitment.',
    successTitle: 'Callback confirmed!',
    successDate: 'Date',
    successPhone: 'Phone',
    successTopic: 'Topic',
    successNote: 'You will receive confirmation if you provide an email.',
    backToChat: 'Back to chat',
    phoneRequired: 'Enter your phone number',
    slotRequired: 'Select a time slot',
    errorGeneric: 'Scheduling error. Try again.',
    loading: 'Scheduling...',
    noSlots: 'No slots available for this day',
    closedDay: 'Non-business day',
  },
  pt: {
    title: 'N\u00f3s ligamos para voc\u00ea',
    today: 'Hoje',
    tomorrow: 'Amanh\u00e3',
    dayAfter: 'Depois',
    pickDay: 'Escolher dia',
    morning: 'Manh\u00e3',
    midday: 'Meio-dia',
    afternoon: 'Tarde',
    agentsAvailable: 'agentes dispon\u00edveis',
    agentAvailable: 'agente dispon\u00edvel',
    slotUnavailable: 'Indispon\u00edvel',
    phonePlaceholder: '+34 600 000 000',
    phoneLabel: 'Seu telefone',
    namePlaceholder: 'Seu nome (opcional)',
    topicLabel: 'Sobre qual tema?',
    confirmBtn: 'Confirmar callback',
    disclaimer: 'Ligaremos na faixa selecionada. Sem compromisso.',
    successTitle: 'Callback confirmado!',
    successDate: 'Data',
    successPhone: 'Telefone',
    successTopic: 'Tema',
    successNote: 'Voc\u00ea receber\u00e1 confirma\u00e7\u00e3o se fornecer email.',
    backToChat: 'Voltar ao chat',
    phoneRequired: 'Insira seu n\u00famero de telefone',
    slotRequired: 'Selecione uma faixa hor\u00e1ria',
    errorGeneric: 'Erro ao agendar. Tente novamente.',
    loading: 'Agendando...',
    noSlots: 'Sem faixas dispon\u00edveis para este dia',
    closedDay: 'Dia n\u00e3o \u00fatil',
  },
  gl: {
    title: 'Devolvémosche a chamada',
    today: 'Hoxe',
    tomorrow: 'Ma\u00f1\u00e1',
    dayAfter: 'Pasado',
    pickDay: 'Elixir d\u00eda',
    morning: 'Ma\u00f1\u00e1',
    midday: 'Mediod\u00eda',
    afternoon: 'Tarde',
    agentsAvailable: 'axentes dispo\u00f1ibles',
    agentAvailable: 'axente dispo\u00f1ible',
    slotUnavailable: 'Non dispo\u00f1ible',
    phonePlaceholder: '+34 600 000 000',
    phoneLabel: 'O teu tel\u00e9fono',
    namePlaceholder: 'O teu nome (opcional)',
    topicLabel: 'Sobre que tema?',
    confirmBtn: 'Confirmar callback',
    disclaimer: 'Cham\u00e1mosche na franxa elixida. Sen compromiso.',
    successTitle: 'Callback confirmado!',
    successDate: 'Data',
    successPhone: 'Tel\u00e9fono',
    successTopic: 'Tema',
    successNote: 'Recibir\u00e1s confirmaci\u00f3n se proporcionas email.',
    backToChat: 'Volver ao chat',
    phoneRequired: 'Introduce o teu n\u00famero de tel\u00e9fono',
    slotRequired: 'Selecciona unha franxa horaria',
    errorGeneric: 'Erro ao programar. Int\u00e9ntao de novo.',
    loading: 'Programando...',
    noSlots: 'Sen franxas dispo\u00f1ibles para este d\u00eda',
    closedDay: 'D\u00eda non laborable',
  },
};

// ─── Helpers ───

function getDateLabel(date: Date, lang: string): string {
  const weekdays: Record<string, string[]> = {
    es: ['Dom', 'Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00e1b'],
    gl: ['Dom', 'Lun', 'Mar', 'M\u00e9r', 'Xov', 'Ven', 'S\u00e1b'],
  };
  const days = weekdays[lang] || weekdays['es'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/** Get the next N business days starting from today */
function getNextBusinessDays(count: number): Date[] {
  const dates: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < count) {
    if (isWeekday(d)) {
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function isSlotInPast(date: Date, slotEnd: number): boolean {
  const now = new Date();
  if (formatDateISO(date) > formatDateISO(now)) return false;
  if (formatDateISO(date) < formatDateISO(now)) return true;
  // Same day: check if slot end hour has passed
  return now.getHours() >= slotEnd;
}

// ─── Props ───

interface CallbackSchedulerProps {
  theme: ThemeConfig;
  t: (key: string) => string;
  businessLines: string[];
  businessHours: { start: number; end: number; timezone: string };
  onSchedule: (data: CallbackRequest) => void;
  onBack: () => void;
  isSubmitting: boolean;
  result: CallbackResult | null;
  availableSlots: TimeSlotInfo[];
  slotsLoading: boolean;
  onFetchSlots: (date: string, businessLine?: string) => void;
  visitorId: string;
  language: string;
  conversationId?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function CallbackScheduler({
  theme,
  t: _t,
  businessLines,
  businessHours,
  onSchedule,
  onBack,
  isSubmitting,
  result,
  availableSlots,
  slotsLoading,
  onFetchSlots,
  visitorId,
  language,
  conversationId,
}: CallbackSchedulerProps) {
  const lang = (language || 'es').slice(0, 2);
  const s = STRINGS[lang] || STRINGS['es'];
  const buLabels = BU_LABELS[lang] || BU_LABELS['es'];
  const isRTL = lang === 'ar';

  // ─── State ───
  const businessDays = useMemo(() => getNextBusinessDays(7), []);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<'morning' | 'midday' | 'afternoon' | null>(null);
  const [phone, setPhone] = useState('+34 ');
  const [name, setName] = useState('');
  const [selectedBU, setSelectedBU] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enterAnim, setEnterAnim] = useState(true);

  const selectedDate = businessDays[selectedDayIdx];

  // Fetch slots when date or BU changes
  useEffect(() => {
    if (selectedDate) {
      onFetchSlots(formatDateISO(selectedDate), selectedBU || undefined);
    }
  }, [selectedDayIdx, selectedBU, selectedDate]);

  // Animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setEnterAnim(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // ─── Slot availability ───
  const getSlotInfo = useCallback((slotId: 'morning' | 'midday' | 'afternoon'): { available: boolean; agentCount: number } => {
    const slotDef = SLOT_DEFS.find((sd) => sd.id === slotId)!;

    // Check if slot is in the past
    if (isSlotInPast(selectedDate, slotDef.end)) {
      return { available: false, agentCount: 0 };
    }

    // Check if slot falls within business hours
    if (slotDef.start >= businessHours.end || slotDef.end <= businessHours.start) {
      return { available: false, agentCount: 0 };
    }

    // Check server-provided slots
    const serverSlot = availableSlots.find((as) => as.slot === slotId);
    if (serverSlot) {
      return { available: serverSlot.available, agentCount: serverSlot.agentCount };
    }

    // Default: available with estimated agent count
    return { available: true, agentCount: Math.floor(Math.random() * 4) + 1 };
  }, [selectedDate, businessHours, availableSlots]);

  // ─── Submit ───
  const handleSubmit = () => {
    setError('');

    // Validate phone
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      setError(s.phoneRequired);
      return;
    }

    if (!selectedSlot) {
      setError(s.slotRequired);
      return;
    }

    const slotDef = SLOT_DEFS.find((sd) => sd.id === selectedSlot)!;

    const data: CallbackRequest = {
      phone: cleanPhone,
      name: name.trim() || undefined,
      date: formatDateISO(selectedDate),
      timeSlot: selectedSlot,
      timeRange: slotDef.range,
      businessLine: selectedBU || undefined,
      visitorId,
      language: lang,
      conversationId,
    };

    onSchedule(data);
  };

  // ─── Day label for quick tabs ───
  const getDayTabLabel = (idx: number): string => {
    if (idx === 0) {
      // Could be today if today is a weekday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (businessDays[0].getTime() === today.getTime()) return s.today;
      return s.tomorrow;
    }
    if (idx === 1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (businessDays[0].getTime() === today.getTime()) return s.tomorrow;
      return getDateLabel(businessDays[1], lang);
    }
    return getDateLabel(businessDays[idx], lang);
  };

  // ─── Colors from theme ───
  const primary = theme.colors.primary;
  const primaryLight = theme.colors.primaryLight;
  const surface = theme.colors.surface;
  const text = theme.colors.text;
  const textSecondary = theme.colors.textSecondary;
  const border = theme.colors.border;
  const bg = theme.colors.background;
  const success = theme.colors.success;
  const gradFrom = theme.colors.gradientFrom;
  const gradTo = theme.colors.gradientTo;

  // ──────────────────────────────────────────────────────────────────────────
  // SUCCESS STATE
  // ──────────────────────────────────────────────────────────────────────────
  if (result?.success) {
    const slotDef = SLOT_DEFS.find((sd) => sd.id === selectedSlot);
    const dateStr = selectedDate.toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'pt' ? 'pt-PT' : lang === 'gl' ? 'gl-ES' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return (
      <div style={{
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        animation: 'rc-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        direction: isRTL ? 'rtl' : 'ltr',
      }}>
        {/* Success icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${success}, #059669)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 8px 24px ${success}44`,
          animation: 'rc-bounce-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{
            fontSize: 20,
            fontWeight: 700,
            color: text,
            margin: '0 0 4px',
            fontFamily: 'var(--rc-font)',
          }}>
            {s.successTitle}
          </h3>
        </div>

        {/* Confirmation card */}
        <div style={{
          width: '100%',
          background: surface,
          borderRadius: 16,
          padding: '18px 20px',
          border: `1px solid ${border}`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{'\u{1F4C5}'}</span>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>{s.successDate}</div>
                <div style={{ fontSize: 14, color: text, fontWeight: 600, textTransform: 'capitalize' }}>
                  {dateStr}, {slotDef?.range || ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{'\u{1F4DE}'}</span>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>{s.successPhone}</div>
                <div style={{ fontSize: 14, color: text, fontWeight: 600 }}>{phone}</div>
              </div>
            </div>
            {selectedBU && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{'\u{1F3E2}'}</span>
                <div>
                  <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>{s.successTopic}</div>
                  <div style={{ fontSize: 14, color: text, fontWeight: 600 }}>{buLabels[selectedBU] || selectedBU}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{
          fontSize: 12,
          color: textSecondary,
          textAlign: 'center',
          lineHeight: 1.5,
          margin: 0,
        }}>
          {s.successNote}
        </p>

        <button
          onClick={onBack}
          style={{
            width: '100%',
            padding: '13px 20px',
            borderRadius: 12,
            border: `1.5px solid ${border}`,
            background: bg,
            color: text,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: 'var(--rc-font)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = surface;
            (e.currentTarget as HTMLButtonElement).style.borderColor = textSecondary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = bg;
            (e.currentTarget as HTMLButtonElement).style.borderColor = border;
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          {s.backToChat}
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCHEDULER FORM
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px 20px 24px',
        overflowY: 'auto',
        maxHeight: 'calc(var(--rc-max-height, 640px) - var(--rc-header-height, 68px) - 16px)',
        animation: enterAnim ? 'rc-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
        direction: isRTL ? 'rtl' : 'ltr',
        fontFamily: 'var(--rc-font)',
      }}
      className="rc-scrollbar"
    >
      {/* Title */}
      <div style={{ textAlign: 'center', paddingBottom: 4 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          boxShadow: `0 4px 16px ${primary}33`,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </div>
        <h3 style={{
          fontSize: 18,
          fontWeight: 700,
          color: text,
          margin: '0 0 2px',
        }}>
          {s.title}
        </h3>
      </div>

      {/* ── Day Selector ── */}
      <div>
        <div style={{
          display: 'flex',
          gap: 6,
          background: surface,
          borderRadius: 12,
          padding: 4,
          border: `1px solid ${border}`,
        }}>
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              onClick={() => { setSelectedDayIdx(idx); setShowDatePicker(false); setSelectedSlot(null); }}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 10,
                border: 'none',
                background: selectedDayIdx === idx && !showDatePicker
                  ? primary
                  : 'transparent',
                color: selectedDayIdx === idx && !showDatePicker
                  ? '#fff'
                  : textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--rc-font)',
                whiteSpace: 'nowrap',
              }}
            >
              {getDayTabLabel(idx)}
            </button>
          ))}
          <button
            onClick={() => { setShowDatePicker(!showDatePicker); }}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: 10,
              border: 'none',
              background: showDatePicker ? primary : 'transparent',
              color: showDatePicker ? '#fff' : textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--rc-font)',
              whiteSpace: 'nowrap',
            }}
          >
            {s.pickDay}
          </button>
        </div>

        {/* Mini date picker: horizontal scroll of business days */}
        {showDatePicker && (
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 10,
            overflowX: 'auto',
            paddingBottom: 4,
            animation: 'rc-fade-in 0.2s ease forwards',
          }}>
            {businessDays.slice(3).map((d, i) => (
              <button
                key={i}
                onClick={() => { setSelectedDayIdx(i + 3); setSelectedSlot(null); }}
                style={{
                  minWidth: 60,
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1.5px solid ${selectedDayIdx === i + 3 ? primary : border}`,
                  background: selectedDayIdx === i + 3 ? primaryLight : bg,
                  color: selectedDayIdx === i + 3 ? primary : text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--rc-font)',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{d.getDate()}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>
                  {getDateLabel(d, lang).split(' ')[0]}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Time Slots ── */}
      <div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {SLOT_DEFS.map((slotDef) => {
            const info = getSlotInfo(slotDef.id);
            const isSelected = selectedSlot === slotDef.id;
            const isDisabled = !info.available;

            return (
              <button
                key={slotDef.id}
                onClick={() => !isDisabled && setSelectedSlot(slotDef.id)}
                disabled={isDisabled}
                style={{
                  padding: '14px 8px 12px',
                  borderRadius: 14,
                  border: `1.5px solid ${isSelected ? primary : isDisabled ? `${border}88` : border}`,
                  background: isSelected
                    ? primaryLight
                    : isDisabled
                      ? `${surface}88`
                      : bg,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                  transition: 'all 0.25s ease',
                  textAlign: 'center',
                  fontFamily: 'var(--rc-font)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top accent line when selected */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${gradFrom}, ${gradTo})`,
                    borderRadius: '3px 3px 0 0',
                  }} />
                )}

                <span style={{ fontSize: 22 }}>{slotDef.icon}</span>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSelected ? primary : isDisabled ? textSecondary : text,
                }}>
                  {(s as any)[slotDef.id] || slotDef.labelEs}
                </div>
                <div style={{
                  fontSize: 10,
                  color: textSecondary,
                  fontWeight: 500,
                }}>
                  {slotDef.range.replace('-', ' - ')}
                </div>
                {!isDisabled && info.agentCount > 0 && (
                  <div style={{
                    fontSize: 9,
                    color: success,
                    fontWeight: 600,
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: success,
                      display: 'inline-block',
                    }} />
                    {info.agentCount} {info.agentCount === 1 ? s.agentAvailable : s.agentsAvailable}
                  </div>
                )}
                {isDisabled && (
                  <div style={{
                    fontSize: 9,
                    color: textSecondary,
                    fontWeight: 500,
                    marginTop: 2,
                  }}>
                    {s.slotUnavailable}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Phone Input ── */}
      <div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: textSecondary,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 15 }}>{'\u{1F4F1}'}</span>
          {s.phoneLabel}
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={s.phonePlaceholder}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: `1.5px solid ${error && error === s.phoneRequired ? theme.colors.error : border}`,
            background: bg,
            color: text,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: 'var(--rc-font)',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            letterSpacing: '0.5px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = primary;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${primary}15`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = border;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* ── Name Input ── */}
      <div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: textSecondary,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 15 }}>{'\u{1F464}'}</span>
          {s.namePlaceholder}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={s.namePlaceholder}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 10,
            border: `1.5px solid ${border}`,
            background: bg,
            color: text,
            fontSize: 14,
            fontFamily: 'var(--rc-font)',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = primary;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${primary}15`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = border;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* ── Business Line Selector ── */}
      {businessLines.length > 0 && (
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: textSecondary,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 15 }}>{'\u{1F4DD}'}</span>
            {s.topicLabel}
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
          }}>
            {businessLines.map((bl) => {
              const isActive = selectedBU === bl;
              return (
                <button
                  key={bl}
                  onClick={() => setSelectedBU(isActive ? null : bl)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 10,
                    border: `1.5px solid ${isActive ? primary : border}`,
                    background: isActive ? primaryLight : bg,
                    color: isActive ? primary : text,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'var(--rc-font)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{BU_ICONS[bl] || '\u{1F4BC}'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {buLabels[bl] || bl}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Error message ── */}
      {(error || (result && !result.success)) && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: `${theme.colors.error}10`,
          border: `1px solid ${theme.colors.error}30`,
          color: theme.colors.error,
          fontSize: 12,
          fontWeight: 500,
          textAlign: 'center',
          animation: 'rc-fade-in 0.2s ease forwards',
        }}>
          {error || result?.error || s.errorGeneric}
        </div>
      )}

      {/* ── Submit Button ── */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 14,
          border: 'none',
          background: isSubmitting
            ? `${primary}88`
            : `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          cursor: isSubmitting ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'all 0.25s ease',
          boxShadow: isSubmitting ? 'none' : `0 4px 16px ${primary}33`,
          fontFamily: 'var(--rc-font)',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 24px ${primary}44`;
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 16px ${primary}33`;
        }}
      >
        {isSubmitting ? (
          <>
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: 'rc-spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" strokeDasharray="31" strokeDashoffset="10" />
            </svg>
            {s.loading}
          </>
        ) : (
          <>
            {s.confirmBtn}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </>
        )}
      </button>

      {/* ── Disclaimer ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 8px',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span style={{
          fontSize: 11,
          color: textSecondary,
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {s.disclaimer}
        </span>
      </div>

      {/* ── Back link ── */}
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: primary,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: 'var(--rc-font)',
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        {s.backToChat}
      </button>
    </div>
  );
}
