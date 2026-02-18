export type WidgetView = 'closed' | 'chat' | 'call' | 'lead_form' | 'offline_form' | 'csat';

export interface WidgetState {
  view: WidgetView;
  isOpen: boolean;
  isTyping: boolean;
  language: string;
  businessLine: string | null;
  isBusinessHours: boolean;
  isConnected: boolean;
  hasAgent: boolean;
  agentName: string | null;
}

export const initialState: WidgetState = {
  view: 'closed',
  isOpen: false,
  isTyping: false,
  language: 'es',
  businessLine: null,
  isBusinessHours: true,
  isConnected: false,
  hasAgent: false,
  agentName: null,
};
