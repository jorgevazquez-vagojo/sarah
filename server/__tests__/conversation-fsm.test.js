const { getValidEvents, TRANSITIONS } = require('../state/conversation-fsm');

describe('Conversation FSM', () => {
  describe('TRANSITIONS map', () => {
    test('has all expected states', () => {
      const states = Object.keys(TRANSITIONS);
      expect(states).toContain('chat_idle');
      expect(states).toContain('chat_active');
      expect(states).toContain('chat_waiting_agent');
      expect(states).toContain('escalation_pending');
      expect(states).toContain('call_connecting');
      expect(states).toContain('call_active');
      expect(states).toContain('call_ended');
      expect(states).toContain('closed');
    });

    test('chat_idle only transitions to chat_active via start', () => {
      expect(TRANSITIONS.chat_idle).toEqual({ start: 'chat_active' });
    });

    test('chat_active can escalate, request_call, or close', () => {
      const events = Object.keys(TRANSITIONS.chat_active);
      expect(events).toContain('escalate');
      expect(events).toContain('request_call');
      expect(events).toContain('close');
    });

    test('closed state has no transitions', () => {
      expect(TRANSITIONS.closed).toEqual({});
    });

    test('all states can reach closed', () => {
      for (const [state, transitions] of Object.entries(TRANSITIONS)) {
        if (state === 'closed' || state === 'chat_idle') continue;
        expect(transitions.close).toBe('closed');
      }
    });

    test('escalation_pending can start call or cancel', () => {
      expect(TRANSITIONS.escalation_pending.call_start).toBe('call_connecting');
      expect(TRANSITIONS.escalation_pending.cancel).toBe('chat_active');
    });

    test('call flow: connecting -> active -> ended', () => {
      expect(TRANSITIONS.call_connecting.connected).toBe('call_active');
      expect(TRANSITIONS.call_active.hangup).toBe('call_ended');
      expect(TRANSITIONS.call_ended.resume_chat).toBe('chat_active');
    });
  });

  describe('getValidEvents', () => {
    test('returns valid events for chat_active', () => {
      const events = getValidEvents('chat_active');
      expect(events).toEqual(['escalate', 'request_call', 'close']);
    });

    test('returns empty array for closed', () => {
      expect(getValidEvents('closed')).toEqual([]);
    });

    test('returns empty array for unknown state', () => {
      expect(getValidEvents('nonexistent')).toEqual([]);
    });

    test('returns ["start"] for chat_idle', () => {
      expect(getValidEvents('chat_idle')).toEqual(['start']);
    });
  });
});
