import { useState, useEffect, useCallback, useRef } from 'react';
import { WSClient } from '../lib/ws-client';

export interface ChatMessage {
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentName?: string;
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
  const wsRef = useRef<WSClient | null>(null);

  useEffect(() => {
    const ws = new WSClient(apiUrl, visitorId);
    wsRef.current = ws;

    ws.on('connected', (data) => {
      setIsConnected(true);
      setIsBusinessHours(data.isBusinessHours);
    });

    ws.on('message', (data) => {
      setMessages((prev) => [...prev, {
        sender: data.sender,
        content: data.content,
        timestamp: data.timestamp,
        agentName: data.agentName,
      }]);
    });

    ws.on('typing', (data) => setIsTyping(data.isTyping));

    ws.on('language_detected', (data) => setLanguageState(data.language));
    ws.on('language_set', (data) => setLanguageState(data.language));
    ws.on('business_line_set', (data) => setBusinessLineState(data.businessLine));

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

    return () => ws.disconnect();
  }, [apiUrl, visitorId]);

  const sendMessage = useCallback((content: string) => {
    wsRef.current?.send('chat', { content });
    setMessages((prev) => [...prev, {
      sender: 'visitor',
      content,
      timestamp: new Date().toISOString(),
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
    language, businessLine,
    sendMessage, setLanguage, setBusinessLine,
    escalate, requestCall, submitLead, submitOfflineForm, submitCsat,
  };
}
