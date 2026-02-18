const { validate, validateObject } = require('../middleware/validate');

describe('Validation Middleware', () => {
  describe('validateObject', () => {
    test('validates required fields', () => {
      const errors = validateObject({}, { name: { required: true, type: 'string' } });
      expect(errors).toContain('name is required');
    });

    test('passes when required field is present', () => {
      const errors = validateObject({ name: 'test' }, { name: { required: true, type: 'string' } });
      expect(errors).toHaveLength(0);
    });

    test('validates string type', () => {
      const errors = validateObject({ name: 123 }, { name: { type: 'string' } });
      expect(errors).toContain('name must be a string');
    });

    test('validates number type', () => {
      const errors = validateObject({ age: 'old' }, { age: { type: 'number' } });
      expect(errors).toContain('age must be a number');
    });

    test('validates minLength', () => {
      const errors = validateObject({ name: 'a' }, { name: { type: 'string', minLength: 2 } });
      expect(errors).toContain('name must be at least 2 characters');
    });

    test('validates maxLength', () => {
      const errors = validateObject({ name: 'abcdef' }, { name: { type: 'string', maxLength: 3 } });
      expect(errors).toContain('name must be at most 3 characters');
    });

    test('validates enum', () => {
      const errors = validateObject({ status: 'invalid' }, { status: { type: 'string', enum: ['a', 'b'] } });
      expect(errors).toContain('status must be one of: a, b');
    });

    test('validates pattern', () => {
      const errors = validateObject({ email: 'bad' }, { email: { type: 'string', pattern: /@/ } });
      expect(errors).toContain('email has invalid format');
    });

    test('validates number min/max', () => {
      const errors = validateObject({ priority: -1 }, { priority: { type: 'number', min: 0, max: 5 } });
      expect(errors).toContain('priority must be >= 0');
    });

    test('skips optional missing fields', () => {
      const errors = validateObject({}, { name: { type: 'string' } });
      expect(errors).toHaveLength(0);
    });

    test('validates array type', () => {
      const errors = validateObject({ tags: 'not-array' }, { tags: { type: 'array' } });
      expect(errors).toContain('tags must be an array');
    });

    test('returns error for non-object body', () => {
      const errors = validateObject(null, { name: { required: true } });
      expect(errors).toContain('Request body must be a JSON object');
    });
  });

  describe('validate middleware', () => {
    test('calls next on valid input', () => {
      const mw = validate({ name: { required: true, type: 'string' } });
      const req = { body: { name: 'test' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('returns 400 on invalid input', () => {
      const mw = validate({ name: { required: true, type: 'string' } });
      const req = { body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
