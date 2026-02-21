import { useState, useEffect, useCallback, useRef } from 'react';
import { WSClient } from '../lib/ws-client';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface RichContent {
  type: 'card' | 'carousel' | 'quick_replies' | 'buttons' | 'image' | 'file';
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  text?: string;
  buttons?: { label: string; action: string; value: string }[];
  cards?: RichContent[];
  replies?: { label: string; value: string }[];
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  caption?: string;
}

export interface KBResult {
  id: number;
  title: string;
  content: string;
  category?: string;
  businessLine?: string;
}

export interface ChatMessage {
  id?: string;
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentName?: string;
  status?: MessageStatus;
  metadata?: any;
  richContent?: RichContent | null;
  attachments?: { name: string; url: string; mimeType: string; size: number }[];
}

interface UseChatOptions {
  apiUrl: string;
  visitorId: string;
}

export function useChat({ apiUrl, visitorId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isBusinessHours, setIsBusinessHours] = useState(true);
  const [language, setLanguageState] = useState('es');
  const [businessLine, setBusinessLineState] = useState<string | null>(null);
  const [allRead, setAllRead] = useState(false);
  const [kbResults, setKbResults] = useState<KBResult[]>([]);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [callStatus, setCallStatus] = useState<{ callId?: string; status: 'idle' | 'requesting' | 'ringing' | 'queued' | 'error'; message?: string }>({ status: 'idle' });
  const [webrtcConfig, setWebrtcConfig] = useState<any>(null);
  const wsRef = useRef<WSClient | null>(null);

  useEffect(() => {
    const ws = new WSClient(apiUrl, visitorId);
    wsRef.current = ws;

    ws.on('connected', (data) => {
      setIsConnected(true);
      setIsBusinessHours(data.isBusinessHours);
    });

    // Chat history persistence: receive past messages on reconnect
    ws.on('chat_history', (data) => {
      if (data.messages?.length) {
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          sender: m.sender === 'note' ? 'system' as const : m.sender,
          content: m.content,
          timestamp: m.timestamp,
          status: 'read' as MessageStatus,
          metadata: m.metadata,
        })).filter((m: ChatMessage) => !m.metadata?.internal));
      }
      if (data.language) setLanguageState(data.language);
      if (data.businessLine) setBusinessLineState(data.businessLine);
    });

    ws.on('message', (data) => {
      setMessages((prev) => [...prev, {
        sender: data.sender,
        content: data.content,
        timestamp: data.timestamp,
        agentName: data.agentName,
        status: 'delivered',
        richContent: data.richContent || null,
      }]);
    });

    // Message delivery/read status updates
    ws.on('message_status', (data) => {
      if (data.status === 'delivered' && data.messageId) {
        // Mark a specific message as delivered
        setMessages((prev) => prev.map((m) =>
          m.id === data.messageId ? { ...m, status: 'delivered' as MessageStatus } : m
        ));
      } else if (data.status === 'read') {
        // Agent read all messages — mark all visitor messages as read
        setAllRead(true);
        setMessages((prev) => prev.map((m) =>
          m.sender === 'visitor' ? { ...m, status: 'read' as MessageStatus } : m
        ));
      }
    });

    ws.on('typing', (data) => setIsTyping(data.isTyping));

    ws.on('language_detected', (data) => setLanguageState(data.language));
    ws.on('language_set', (data) => setLanguageState(data.language));
    ws.on('business_line_set', (data) => setBusinessLineState(data.businessLine));
    ws.on('business_line_detected', (data) => setBusinessLineState(data.businessLine));

    ws.on('escalating', (data) => {
      setMessages((prev) => [...prev, {
        sender: 'system',
        content: data.message,
        timestamp: new Date().toISOString(),
      }]);
    });

    ws.on('lead_saved', (data) => {
      setMessages((prev) => [...prev, {
        sender: 'system',
        content: data.message,
        timestamp: new Date().toISOString(),
      }]);
    });

    ws.on('offline_form_saved', (data) => {
      setMessages((prev) => [...prev, {
        sender: 'system',
        content: data.message,
        timestamp: new Date().toISOString(),
      }]);
    });

    // Help Center KB search results
    ws.on('kb_results', (data) => {
      setKbResults(data.results || []);
    });

    // Server requests showing lead form (from rich message postback)
    ws.on('show_lead_form', () => {
      setShowLeadForm(true);
    });

    // Click2Call: callback flow responses
    ws.on('show_phone_form', () => {
      setShowPhoneForm(true);
    });

    ws.on('call_initiated', (data) => {
      setCallStatus({ callId: data.callId, status: 'ringing', message: data.message });
    });

    ws.on('call_queued', (data) => {
      setCallStatus({ callId: data.callId, status: 'queued', message: data.message });
    });

    ws.on('call_error', (data) => {
      setCallStatus({ status: 'error', message: data.message });
    });

    // WebRTC via Janus: server sends connection details
    ws.on('webrtc_ready', (data) => {
      setCallStatus({ callId: data.callId, status: 'ringing' });
      setWebrtcConfig(data);
    });

    ws.on('_close', () => setIsConnected(false));
    ws.on('_open', () => setIsConnected(true));

    ws.connect();

    // Send page context on connect for context-aware greetings
    const sendPageContext = () => {
      ws.send('page_context', {
        pageUrl: window.location.href,
        pageTitle: document.title,
        referrer: document.referrer || null,
      });
    };
    // Small delay to ensure connection is established
    const contextTimer = setTimeout(sendPageContext, 500);

    return () => {
      clearTimeout(contextTimer);
      ws.disconnect();
    };
  }, [apiUrl, visitorId]);

  const sendMessage = useCallback((content: string) => {
    const tempId = `temp-${Date.now()}`;
    wsRef.current?.send('chat', { content });
    setMessages((prev) => [...prev, {
      id: tempId,
      sender: 'visitor',
      content,
      timestamp: new Date().toISOString(),
      status: 'sent',
    }]);
  }, []);

  const setLanguage = useCallback((lang: string) => {
    wsRef.current?.send('set_language', { language: lang });
    setLanguageState(lang);
  }, []);

  const setBusinessLine = useCallback((line: string) => {
    wsRef.current?.send('set_business_line', { businessLine: line });
    setBusinessLineState(line);
  }, []);

  const escalate = useCallback(() => {
    wsRef.current?.send('escalate', {});
  }, []);

  const requestCall = useCallback((phone: string) => {
    setCallStatus({ status: 'requesting' });
    wsRef.current?.send('request_call', { phone });
  }, []);

  const requestWebRTCCall = useCallback(() => {
    setCallStatus({ status: 'requesting' });
    wsRef.current?.send('request_webrtc_call', {});
  }, []);

  const sendWebRTCHangup = useCallback((callId: string, duration?: number) => {
    wsRef.current?.send('webrtc_hangup', { callId, duration });
  }, []);

  const clearWebrtcConfig = useCallback(() => setWebrtcConfig(null), []);

  const submitLead = useCallback((data: { name: string; email: string; phone?: string; company?: string }) => {
    wsRef.current?.send('lead_submit', data);
  }, []);

  const submitOfflineForm = useCallback((data: { name: string; email: string; phone?: string; message?: string; language?: string }) => {
    wsRef.current?.send('offline_form', data);
  }, []);

  const submitCsat = useCallback((rating: number, comment?: string) => {
    wsRef.current?.send('csat', { rating, comment });
  }, []);

  const searchKB = useCallback((query: string) => {
    wsRef.current?.send('search_kb', { query, businessLine: businessLine || undefined });
  }, [businessLine]);

  const sendQuickReply = useCallback((value: string) => {
    wsRef.current?.send('quick_reply', { value });
  }, []);

  const uploadFile = useCallback(async (file: File, baseUrl: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${baseUrl}/api/upload?sender=visitor`, {
      method: 'POST',
      body: formData,
      headers: { 'X-API-Key': 'widget' },
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    // Send as a chat message with attachment info
    wsRef.current?.send('chat', {
      content: file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`,
    });
    setMessages((prev) => [...prev, {
      sender: 'visitor',
      content: file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`,
      timestamp: new Date().toISOString(),
      status: 'sent',
      attachments: [{ name: data.name, url: data.url, mimeType: data.mimeType, size: data.size }],
    }]);
    return data;
  }, []);

  const clearLeadForm = useCallback(() => setShowLeadForm(false), []);

  const clearPhoneForm = useCallback(() => setShowPhoneForm(false), []);
  const resetCallStatus = useCallback(() => setCallStatus({ status: 'idle' }), []);

  return {
    messages, isTyping, isConnected, isBusinessHours,
    language, businessLine, allRead, kbResults, showLeadForm, showPhoneForm, callStatus,
    webrtcConfig,
    sendMessage, setLanguage, setBusinessLine,
    escalate, requestCall, requestWebRTCCall, sendWebRTCHangup,
    submitLead, submitOfflineForm, submitCsat,
    searchKB, sendQuickReply, uploadFile, clearLeadForm, clearPhoneForm, resetCallStatus,
    clearWebrtcConfig,
  };
}
