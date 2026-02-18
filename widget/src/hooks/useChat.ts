import { useState, useEffect, useCallback, useRef } from 'react';
import { WSClient } from '../lib/ws-client';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id?: string;
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentName?: string;
  status?: MessageStatus;
  metadata?: any;
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

  const requestCall = useCallback(() => {
    wsRef.current?.send('request_call', {});
  }, []);

  const submitLead = useCallback((data: { name: string; email: string; phone?: string; company?: string }) => {
    wsRef.current?.send('lead_submit', data);
  }, []);

  const submitOfflineForm = useCallback((data: { name: string; email: string; phone?: string; message?: string; language?: string }) => {
    wsRef.current?.send('offline_form', data);
  }, []);

  const submitCsat = useCallback((rating: number, comment?: string) => {
    wsRef.current?.send('csat', { rating, comment });
  }, []);

  return {
    messages, isTyping, isConnected, isBusinessHours,
    language, businessLine, allRead,
    sendMessage, setLanguage, setBusinessLine,
    escalate, requestCall, submitLead, submitOfflineForm, submitCsat,
  };
}
