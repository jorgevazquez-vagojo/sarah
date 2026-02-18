const { EVENTS } = require('../integrations/webhooks');

describe('Webhooks', () => {
  describe('EVENTS', () => {
    test('contains expected event types', () => {
      expect(EVENTS).toContain('conversation.started');
      expect(EVENTS).toContain('conversation.closed');
      expect(EVENTS).toContain('message.received');
      expect(EVENTS).toContain('message.sent');
      expect(EVENTS).toContain('lead.created');
      expect(EVENTS).toContain('lead.updated');
      expect(EVENTS).toContain('agent.assigned');
      expect(EVENTS).toContain('call.started');
      expect(EVENTS).toContain('call.ended');
      expect(EVENTS).toContain('csat.submitted');
    });

    test('has 11 event types', () => {
      expect(EVENTS).toHaveLength(11);
    });

    test('all events follow dot notation', () => {
      for (const event of EVENTS) {
        expect(event).toMatch(/^\w+\.\w+$/);
      }
    });
  });
});
