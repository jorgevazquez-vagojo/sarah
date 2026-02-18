// Mock dependencies before requiring chat-handler
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../utils/db', () => ({ db: {} }));
jest.mock('../utils/redis', () => ({ redis: { subscribe: jest.fn().mockResolvedValue(null) } }));
jest.mock('../utils/i18n', () => ({ t: jest.fn((l, k) => k) }));
jest.mock('../state/session-store', () => ({ sessionStore: { get: jest.fn(), update: jest.fn() } }));
jest.mock('../state/conversation-fsm', () => ({ transition: jest.fn() }));
jest.mock('../services/language-detector', () => ({ detectLanguage: jest.fn(() => 'es') }));
jest.mock('../services/router', () => ({
  generateResponse: jest.fn(),
  detectBusinessLine: jest.fn(),
  isBusinessHours: jest.fn(() => true),
  BUSINESS_LINES: ['boostic', 'binnacle', 'marketing', 'tech'],
}));
jest.mock('../services/lead-capture', () => ({ scoreLead: jest.fn() }));
jest.mock('../services/knowledge-base', () => ({ searchKnowledge: jest.fn() }));
jest.mock('../integrations/webhooks', () => ({ triggerWebhooks: jest.fn() }));
jest.mock('../integrations/crm', () => ({ dispatchToCRM: jest.fn() }));

const { buildRichReply } = require('../ws/chat-handler');

describe('buildRichReply', () => {
  test('returns quick_replies when asking about services without line', () => {
    const result = buildRichReply('qué servicios ofrecéis', 'Ofrecemos...', null, 'es');
    expect(result).not.toBeNull();
    expect(result.type).toBe('quick_replies');
    expect(result.replies.length).toBe(4);
  });

  test('returns null for generic questions', () => {
    const result = buildRichReply('hola, buenos días', 'Hola!', null, 'es');
    expect(result).toBeNull();
  });

  test('returns card when asking about a specific line', () => {
    const result = buildRichReply('cuéntame más sobre boostic', 'Boostic es...', 'boostic', 'es');
    expect(result).not.toBeNull();
    expect(result.type).toBe('card');
    expect(result.title).toContain('Boostic');
    expect(result.buttons.length).toBe(2);
  });

  test('returns buttons when asking about pricing', () => {
    const result = buildRichReply('necesito un presupuesto para SEO', 'Los precios dependen...', null, 'es');
    expect(result).not.toBeNull();
    expect(result.type).toBe('buttons');
    expect(result.buttons.length).toBe(3);
    expect(result.buttons[0].value).toBe('__escalate__');
  });

  test('returns null for line-specific questions without interest keywords', () => {
    const result = buildRichReply('hola', 'Hola!', 'boostic', 'es');
    expect(result).toBeNull();
  });

  test('quick_replies includes all four business lines', () => {
    const result = buildRichReply('What services do you offer?', 'We offer...', null, 'en');
    expect(result).not.toBeNull();
    expect(result.replies.map((r) => r.label)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Boostic'),
        expect.stringContaining('Binnacle'),
        expect.stringContaining('Marketing'),
        expect.stringContaining('Tech'),
      ])
    );
  });

  test('pricing buttons include escalate, lead_form, and call actions', () => {
    const result = buildRichReply('necesito un presupuesto', 'Claro...', 'tech', 'es');
    expect(result).not.toBeNull();
    expect(result.type).toBe('buttons');
    const values = result.buttons.map((b) => b.value);
    expect(values).toContain('__escalate__');
    expect(values).toContain('__lead_form__');
    expect(values).toContain('__call__');
  });
});
