jest.mock('../utils/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

const { evaluateTriggers, TRIGGER_TYPES } = require('../services/proactive-triggers');

describe('Proactive Triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports trigger types', () => {
    expect(TRIGGER_TYPES).toBeDefined();
    expect(TRIGGER_TYPES.time_on_page).toBeDefined();
    expect(TRIGGER_TYPES.pricing_page).toBeDefined();
    expect(TRIGGER_TYPES.exit_intent).toBeDefined();
    expect(TRIGGER_TYPES.return_visitor).toBeDefined();
  });

  test('time_on_page triggers after 30 seconds', async () => {
    const result = await evaluateTriggers('v1', { timeOnPage: 31, language: 'es' });
    expect(result).toBeTruthy();
    expect(result.trigger).toBe('time_on_page');
    expect(result.message).toBeTruthy();
  });

  test('does not trigger when timeOnPage < 30', async () => {
    const result = await evaluateTriggers('v2', { timeOnPage: 10, language: 'es' });
    // May return null or another trigger, but not time_on_page
    if (result) expect(result.trigger).not.toBe('time_on_page');
  });

  test('pricing_page triggers on pricing URL', async () => {
    const result = await evaluateTriggers('v3', { pageUrl: '/precios', language: 'es' });
    expect(result).toBeTruthy();
    expect(result.trigger).toBe('pricing_page');
  });

  test('exit_intent triggers', async () => {
    const result = await evaluateTriggers('v4', { exitIntent: true, language: 'es' });
    expect(result).toBeTruthy();
    expect(result.trigger).toBe('exit_intent');
  });

  test('return_visitor triggers on visitCount >= 2', async () => {
    const result = await evaluateTriggers('v5', { visitCount: 3, language: 'en' });
    expect(result).toBeTruthy();
    expect(result.trigger).toBe('return_visitor');
    expect(result.message).toContain('Welcome back');
  });

  test('returns highest priority trigger when multiple match', async () => {
    const result = await evaluateTriggers('v6', {
      timeOnPage: 31,
      pageUrl: '/precios',
      exitIntent: true,
      language: 'es',
    });
    expect(result).toBeTruthy();
    // pricing_page has priority 3 (highest)
    expect(result.trigger).toBe('pricing_page');
  });

  test('respects cooldown', async () => {
    const { redis } = require('../utils/redis');
    redis.get.mockResolvedValueOnce('1'); // cooldown active for time_on_page
    const result = await evaluateTriggers('v7', { timeOnPage: 31, language: 'es' });
    // Should not trigger time_on_page due to cooldown
    if (result) expect(result.trigger).not.toBe('time_on_page');
  });
});
