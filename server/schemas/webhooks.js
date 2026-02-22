const Joi = require('joi');

const VALID_EVENTS = [
  'conversation.started',
  'conversation.closed',
  'message.received',
  'message.sent',
  'lead.created',
  'lead.updated',
  'agent.assigned',
  'agent.transferred',
  'call.started',
  'call.ended',
  'csat.submitted',
];

const createWebhook = Joi.object({
  url: Joi.string().uri({ scheme: ['http', 'https'] }).max(1000).required()
    .messages({ 'string.uri': 'URL must be a valid HTTP/HTTPS URL' }),
  events: Joi.array().items(Joi.string().valid(...VALID_EVENTS)).min(1).max(VALID_EVENTS.length).required()
    .messages({
      'array.min': 'At least one event must be specified',
      'any.only': `Events must be one of: ${VALID_EVENTS.join(', ')}`,
    }),
  secret: Joi.string().trim().max(200).allow('', null).optional(),
});

module.exports = { createWebhook, VALID_EVENTS };
