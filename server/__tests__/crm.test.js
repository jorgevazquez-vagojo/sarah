const { createAdapter, ADAPTERS } = require('../integrations/crm');

describe('CRM Integration', () => {
  describe('ADAPTERS', () => {
    test('supports Salesforce', () => {
      expect(ADAPTERS).toHaveProperty('salesforce');
    });

    test('supports HubSpot', () => {
      expect(ADAPTERS).toHaveProperty('hubspot');
    });

    test('supports Zoho', () => {
      expect(ADAPTERS).toHaveProperty('zoho');
    });

    test('supports Pipedrive', () => {
      expect(ADAPTERS).toHaveProperty('pipedrive');
    });

    test('has exactly 4 adapters', () => {
      expect(Object.keys(ADAPTERS)).toHaveLength(4);
    });
  });

  describe('createAdapter', () => {
    test('creates Salesforce adapter', () => {
      const adapter = createAdapter('salesforce', { instanceUrl: 'https://test.salesforce.com' });
      expect(adapter).toBeDefined();
      expect(typeof adapter.createContact).toBe('function');
      expect(typeof adapter.createDeal).toBe('function');
      expect(typeof adapter.test).toBe('function');
    });

    test('creates HubSpot adapter', () => {
      const adapter = createAdapter('hubspot', { apiKey: 'test' });
      expect(adapter).toBeDefined();
      expect(typeof adapter.createContact).toBe('function');
      expect(typeof adapter.logActivity).toBe('function');
    });

    test('creates Zoho adapter', () => {
      const adapter = createAdapter('zoho', { refreshToken: 'test' });
      expect(adapter).toBeDefined();
    });

    test('creates Pipedrive adapter', () => {
      const adapter = createAdapter('pipedrive', { domain: 'test', apiKey: 'test' });
      expect(adapter).toBeDefined();
    });

    test('throws for unknown CRM type', () => {
      expect(() => createAdapter('unknown', {})).toThrow('Unknown CRM type: unknown');
    });
  });

  describe('Adapter interface compliance', () => {
    const adapters = [
      ['salesforce', { instanceUrl: 'https://test.salesforce.com' }],
      ['hubspot', { apiKey: 'test' }],
      ['zoho', { refreshToken: 'test' }],
      ['pipedrive', { domain: 'test', apiKey: 'test' }],
    ];

    test.each(adapters)('%s adapter has createContact method', (type, config) => {
      const adapter = createAdapter(type, config);
      expect(typeof adapter.createContact).toBe('function');
    });

    test.each(adapters)('%s adapter has test method', (type, config) => {
      const adapter = createAdapter(type, config);
      expect(typeof adapter.test).toBe('function');
    });
  });
});
