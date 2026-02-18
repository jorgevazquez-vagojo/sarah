import { useState, useEffect, useCallback } from 'react';

const cache: Record<string, Record<string, string>> = {};

async function fetchStrings(baseUrl: string, lang: string): Promise<Record<string, string>> {
  if (cache[lang]) return cache[lang];
  try {
    const res = await fetch(`${baseUrl}/api/config/languages/${lang}`);
    if (res.ok) {
      const data = await res.json();
      cache[lang] = data;
      return data;
    }
  } catch {}
  return {};
}

// Inline fallback strings (no server call needed for basic operation)
const FALLBACK: Record<string, Record<string, string>> = {
  es: { greeting: '¡Hola! ¿En qué puedo ayudarte?', placeholder: 'Escribe tu mensaje...', send: 'Enviar', escalate: 'Hablar con un agente', call: 'Llamar', offline_title: 'Fuera de horario', offline_message: 'Déjanos tus datos y te contactaremos.', offline_form_name: 'Nombre *', offline_form_email: 'Email *', offline_form_phone: 'Teléfono (opcional)', offline_form_message: 'Mensaje (opcional)', offline_form_submit: 'Enviar', welcome_title: 'Bienvenido a Redegal', welcome_subtitle: 'Estamos aquí para ayudarte.', typing: 'Escribiendo...', powered_by: 'Powered by Redegal', quick_reply_yes: 'Sí', quick_reply_no: 'No', quick_reply_more_info: 'Más información', quick_reply_contact: 'Contactar', quick_reply_pricing: 'Precios', back_to_chat: 'Volver al chat', end_conversation: 'Finalizar', csat_question: '¿Cómo valorarías tu experiencia?', csat_thanks: '¡Gracias!', rating_terrible: 'Pésima', rating_bad: 'Mala', rating_okay: 'Regular', rating_good: 'Buena', rating_excellent: 'Excelente', new_conversation: 'Nueva conversación', attach_file: 'Adjuntar', sound_on: 'Sonido activado', sound_off: 'Silenciar', connection_lost: 'Conexión perdida', reconnecting: 'Reconectando...', connected: 'Conectado', boostic: 'SEO & Growth', binnacle: 'Business Intelligence', marketing: 'Marketing Digital', tech: 'Desarrollo Tech', select_business_line: '¿Sobre qué servicio quieres saber más?', agent_connecting: 'Conectando con un agente...', no_agents: 'No hay agentes disponibles. ¿Puedo ayudarte?', file_upload: 'Subir archivo', file_too_large: 'Archivo demasiado grande (máx. 10 MB)', offline_form_thanks: '¡Recibido! Te contactaremos pronto.', lead_thanks: '¡Gracias, {{name}}! Te contactaremos pronto.', schedule_call: 'Programar llamada', rate_experience: 'Valora tu experiencia' },
  en: { greeting: 'Hello! How can I help you?', placeholder: 'Type your message...', send: 'Send', escalate: 'Talk to an agent', call: 'Call', offline_title: 'Outside business hours', offline_message: 'Leave your details and we will contact you.', offline_form_name: 'Name *', offline_form_email: 'Email *', offline_form_phone: 'Phone (optional)', offline_form_message: 'Message (optional)', offline_form_submit: 'Send', welcome_title: 'Welcome to Redegal', welcome_subtitle: 'We are here to help.', typing: 'Typing...', powered_by: 'Powered by Redegal', quick_reply_yes: 'Yes', quick_reply_no: 'No', quick_reply_more_info: 'More info', quick_reply_contact: 'Contact us', quick_reply_pricing: 'Pricing', back_to_chat: 'Back to chat', end_conversation: 'End chat', csat_question: 'How would you rate your experience?', csat_thanks: 'Thank you!', rating_terrible: 'Terrible', rating_bad: 'Bad', rating_okay: 'Okay', rating_good: 'Good', rating_excellent: 'Excellent', new_conversation: 'New conversation', attach_file: 'Attach', sound_on: 'Sound on', sound_off: 'Sound off', connection_lost: 'Connection lost', reconnecting: 'Reconnecting...', connected: 'Connected', boostic: 'SEO & Growth', binnacle: 'Business Intelligence', marketing: 'Digital Marketing', tech: 'Tech Development', select_business_line: 'Which service interests you?', agent_connecting: 'Connecting to an agent...', no_agents: 'No agents available. Can I help?', file_upload: 'Upload file', file_too_large: 'File too large (max 10 MB)', offline_form_thanks: 'Received! We will contact you soon.', lead_thanks: 'Thank you, {{name}}! We will contact you soon.', schedule_call: 'Schedule a call', rate_experience: 'Rate your experience' },
};

export function useLanguage(lang: string, baseUrl?: string) {
  const [strings, setStrings] = useState<Record<string, string>>(FALLBACK[lang] || FALLBACK['es']);

  useEffect(() => {
    if (baseUrl) {
      fetchStrings(baseUrl, lang).then((s) => {
        if (Object.keys(s).length > 0) setStrings(s);
        else setStrings(FALLBACK[lang] || FALLBACK['es']);
      });
    } else {
      setStrings(FALLBACK[lang] || FALLBACK['es']);
    }
  }, [lang, baseUrl]);

  const t = useCallback((key: string, vars: Record<string, string> = {}): string => {
    let str = strings[key] || FALLBACK['es']?.[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    return str;
  }, [strings]);

  return { t, isRTL: false };
}
