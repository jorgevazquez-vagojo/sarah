const Joi = require('joi');

// Theme config update (partial — deep merge on server)
const updateTheme = Joi.object({
  config: Joi.object({
    branding: Joi.object({
      companyName: Joi.string().max(200).optional(),
      logoUrl: Joi.string().uri().allow('').max(1000).optional(),
      faviconUrl: Joi.string().uri().allow('').max(1000).optional(),
      poweredByText: Joi.string().max(200).optional(),
      showPoweredBy: Joi.boolean().optional(),
    }).optional(),
    colors: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string().pattern(/^#[0-9a-fA-F]{3,8}$/), Joi.boolean())
    ).optional(),
    typography: Joi.object({
      fontFamily: Joi.string().max(500).optional(),
      fontSize: Joi.number().integer().min(10).max(24).optional(),
      headerFontSize: Joi.number().integer().min(12).max(32).optional(),
      messagesFontSize: Joi.number().integer().min(10).max(24).optional(),
    }).optional(),
    layout: Joi.object({
      position: Joi.string().valid('bottom-right', 'bottom-left').optional(),
      offsetX: Joi.number().integer().min(0).max(200).optional(),
      offsetY: Joi.number().integer().min(0).max(200).optional(),
      width: Joi.number().integer().min(280).max(800).optional(),
      maxHeight: Joi.number().integer().min(400).max(1200).optional(),
      borderRadius: Joi.number().integer().min(0).max(32).optional(),
      buttonSize: Joi.number().integer().min(40).max(120).optional(),
      buttonBorderRadius: Joi.number().integer().min(0).max(60).optional(),
      headerHeight: Joi.number().integer().min(40).max(120).optional(),
      zIndex: Joi.number().integer().min(1).optional(),
      mobileFullscreen: Joi.boolean().optional(),
    }).optional(),
    features: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.boolean(), Joi.number(), Joi.array())).optional(),
    i18n: Joi.object({
      defaultLanguage: Joi.string().valid('es', 'en', 'pt', 'gl').optional(),
      availableLanguages: Joi.array().items(Joi.string().valid('es', 'en', 'pt', 'gl')).optional(),
      autoDetect: Joi.boolean().optional(),
    }).optional(),
    businessHours: Joi.object({
      timezone: Joi.string().max(100).optional(),
      schedule: Joi.array().items(Joi.object({
        days: Joi.array().items(Joi.number().integer().min(0).max(6)).required(),
        start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
      })).optional(),
      holidays: Joi.array().items(Joi.string()).optional(),
    }).optional(),
    messages: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.number(), Joi.boolean(), Joi.string())).optional(),
    sounds: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    businessLines: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      icon: Joi.string().optional(),
      color: Joi.string().pattern(/^#[0-9a-fA-F]{3,8}$/).optional(),
    })).optional(),
  }).required(),
});

// Tenant creation
const createTenant = Joi.object({
  slug: Joi.string().trim().alphanum().min(2).max(50).required(),
  name: Joi.string().trim().min(1).max(200).required(),
  domain: Joi.string().trim().max(200).allow('', null).optional(),
});

// Canned response creation
const createCanned = Joi.object({
  shortcut: Joi.string().trim().min(1).max(50).required(),
  title: Joi.string().trim().min(1).max(200).required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  language: Joi.string().valid('es', 'en', 'pt', 'gl').default('es').optional(),
  businessLine: Joi.string().max(32).allow('', null).optional(),
  category: Joi.string().max(64).allow('', null).optional(),
});

module.exports = { updateTheme, createTenant, createCanned };
