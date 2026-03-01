const { z } = require('zod');

const schemas = {
  message: z.object({
    tenant_id: z.string().uuid(),
    session_id: z.string().uuid(),
    text: z.string().min(1).max(5000),
    lang: z.enum(['es', 'en', 'pt', 'gl']).optional(),
  }),

  lead: z.object({
    tenant_id: z.string().uuid(),
    name: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().max(20).optional(),
    business_line: z.enum(['boostic', 'binnacle', 'marketing', 'tech']),
  }),

  webhook: z.object({
    tenant_id: z.string().uuid(),
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    active: z.boolean().optional(),
  }),

  themeConfig: z.object({
    tenant_id: z.string().uuid(),
    colors: z.object({
      primary: z.string().regex(/^#[0-9A-F]{6}$/i),
      accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    }).optional(),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
  }),
};

const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse(req.body);
    req.validated = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: err.errors,
      });
    }
    next(err);
  }
};

module.exports = { schemas, validate };
