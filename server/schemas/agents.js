const Joi = require('joi');

const VALID_ROLES = ['agent', 'supervisor', 'admin', 'architect', 'developer', 'qa'];
const VALID_LANGUAGES = ['es', 'en', 'pt', 'gl'];
const VALID_BUSINESS_LINES = ['boostic', 'binnacle', 'marketing', 'tech'];

const createAgent = Joi.object({
  username: Joi.string().trim().alphanum().min(2).max(100).required()
    .messages({ 'string.alphanum': 'Username must be alphanumeric' }),
  password: Joi.string().min(8).max(200).required()
    .messages({ 'string.min': 'Password must be at least 8 characters' }),
  displayName: Joi.string().trim().min(1).max(200).required(),
  email: Joi.string().email().max(320).allow('', null).optional(),
  role: Joi.string().valid(...VALID_ROLES).default('agent').optional(),
  languages: Joi.array().items(Joi.string().valid(...VALID_LANGUAGES)).min(1).default(['es']).optional(),
  businessLines: Joi.array().items(Joi.string().valid(...VALID_BUSINESS_LINES)).default([]).optional(),
  sipExtension: Joi.string().trim().max(20).allow('', null).optional(),
});

const loginAgent = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  password: Joi.string().min(4).max(200).required(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('online', 'busy', 'away', 'offline').required(),
});

module.exports = { createAgent, loginAgent, updateStatus, VALID_ROLES, VALID_LANGUAGES, VALID_BUSINESS_LINES };
