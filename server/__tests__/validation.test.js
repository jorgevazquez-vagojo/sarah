const { schemas, validate } = require('../utils/validation');

describe('Validation Schemas', () => {
  describe('message schema', () => {
    it('should validate correct message', () => {
      const valid = {
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        text: 'Hello',
        lang: 'es',
      };
      expect(() => schemas.message.parse(valid)).not.toThrow();
    });

    it('should reject empty text', () => {
      const invalid = {
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        text: '',
      };
      expect(() => schemas.message.parse(invalid)).toThrow();
    });
  });
});
