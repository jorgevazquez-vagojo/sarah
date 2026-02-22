/**
 * Request validation middleware.
 *
 * Supports two modes:
 *   1. Joi schema validation (preferred): validate(joiSchema)
 *   2. Legacy lightweight validation: validate({ field: { required, type, ... } })
 *
 * The middleware auto-detects which mode to use based on whether the schema
 * has a Joi `validate` method or is a plain object.
 */

/**
 * Validate request body against a schema.
 * @param {object} schema — Either a Joi schema or a plain field-rules object
 * @param {string} [source='body'] — 'body', 'query', or 'params'
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];

    // ── Joi schema (has .validate method) ──
    if (typeof schema.validate === 'function') {
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });
      if (error) {
        const details = error.details.map((d) => d.message);
        return res.status(400).json({ error: 'Validation failed', details });
      }
      // Replace body/query/params with the sanitized version from Joi
      req[source] = value;
      return next();
    }

    // ── Legacy lightweight validation ──
    const errors = validateObject(data, schema);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

function validateObject(obj, schema) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return ['Request body must be a JSON object'];
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
    } else if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    }

    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} has invalid format`);
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be >= ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be <= ${rules.max}`);
      }
    }

    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push(`${field} must have at most ${rules.maxItems} items`);
      }
    }
  }

  return errors;
}

module.exports = { validate, validateObject };
