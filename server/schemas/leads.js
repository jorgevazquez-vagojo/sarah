const Joi = require('joi');

// Create / capture a new lead
const createLead = Joi.object({
  name: Joi.string().trim().min(1).max(200).required()
    .messages({ 'any.required': 'Name is required' }),
  email: Joi.string().email().max(320).required()
    .messages({ 'any.required': 'Email is required', 'string.email': 'Must be a valid email address' }),
  phone: Joi.string().trim().max(30).pattern(/^[+\d\s()-]+$/).allow('', null).optional()
    .messages({ 'string.pattern.base': 'Phone must contain only digits, spaces, +, -, (, )' }),
  company: Joi.string().trim().max(200).allow('', null).optional(),
  businessLine: Joi.string().trim().max(32).valid('boostic', 'binnacle', 'marketing', 'tech').allow(null).optional(),
  language: Joi.string().trim().max(5).valid('es', 'en', 'pt', 'gl').allow(null).optional(),
  conversationId: Joi.string().uuid().allow(null).optional(),
});

// Update an existing lead
const updateLead = Joi.object({
  status: Joi.string().valid('new', 'contacted', 'qualified', 'converted', 'lost').optional(),
  notes: Joi.string().max(5000).allow('', null).optional(),
  name: Joi.string().trim().min(1).max(200).optional(),
  email: Joi.string().email().max(320).optional(),
  phone: Joi.string().trim().max(30).pattern(/^[+\d\s()-]+$/).allow('', null).optional(),
  company: Joi.string().trim().max(200).allow('', null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createLead, updateLead };
