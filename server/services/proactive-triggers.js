const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { t } = require('../utils/i18n');

// Proactive trigger definitions — configurable per tenant
const TRIGGER_TYPES = {
  time_on_page: {
    check: (ctx) => ctx.timeOnPage >= (ctx.config?.threshold || 30),
    message: (lang, ctx) => t(lang, 'greeting') || 'Can we help you with something?',
    cooldownSec: 300,
    priority: 1,
  },
  pricing_page: {
    check: (ctx) => /\/precio|\/pricing|\/plans?|\/tarifa/i.test(ctx.pageUrl || ''),
    message: (lang) => t(lang, 'quick_reply_pricing') ? `Looking for pricing info? We can help!` : null,
    customMessage: {
      es: 'Veo que consultas nuestros precios. ¿Te puedo ayudar a encontrar el plan ideal?',
      en: 'I see you are checking our prices. Can I help you find the right plan?',
      pt: 'Vejo que consulta nossos preços. Posso ajudar a encontrar o plano ideal?',
      gl: 'Vexo que consultas os nosos prezos. Podo axudarche a atopar o plan ideal?',
    },
    cooldownSec: 600,
    priority: 3,
  },
  exit_intent: {
    check: (ctx) => ctx.exitIntent === true,
    customMessage: {
      es: 'Antes de irte, ¿hay algo en lo que podamos ayudarte?',
      en: 'Before you go, is there anything we can help you with?',
      pt: 'Antes de ir, há algo em que possamos ajudar?',
      gl: 'Antes de irte, hai algo no que poidamos axudarche?',
    },
    cooldownSec: 900,
    priority: 2,
  },
  return_visitor: {
    check: (ctx) => (ctx.visitCount || 0) >= 2,
    customMessage: {
      es: '¡Hola de nuevo! ¿En qué podemos ayudarte hoy?',
      en: 'Welcome back! How can we help you today?',
      pt: 'Olá novamente! Como podemos ajudar hoje?',
      gl: 'Ola de novo! En que podemos axudarche hoxe?',
    },
    cooldownSec: 3600,
    priority: 1,
  },
  cart_abandon: {
    check: (ctx) => ctx.cartValue > 0 && ctx.timeOnPage > 60,
    customMessage: {
      es: 'Veo que tienes artículos en el carrito. ¿Puedo ayudarte con el proceso de compra?',
      en: 'I see you have items in your cart. Can I help you with the checkout?',
      pt: 'Vejo que tem artigos no carrinho. Posso ajudar com o processo de compra?',
      gl: 'Vexo que tes artigos no carriño. Podo axudarche co proceso de compra?',
    },
    cooldownSec: 1200,
    priority: 4,
  },
  idle_on_form: {
    check: (ctx) => ctx.formInteraction && ctx.idleTime > 20,
    customMessage: {
      es: '¿Necesitas ayuda completando el formulario?',
      en: 'Need help completing the form?',
      pt: 'Precisa de ajuda para completar o formulário?',
      gl: 'Necesitas axuda completando o formulario?',
    },
    cooldownSec: 300,
    priority: 2,
  },
};

async function evaluateTriggers(visitorId, context) {
  const triggered = [];

  for (const [name, trigger] of Object.entries(TRIGGER_TYPES)) {
    try {
      if (!trigger.check(context)) continue;

      // Check cooldown
      const cooldownKey = `proactive:${visitorId}:${name}`;
      const recent = await redis.get(cooldownKey);
      if (recent) continue;

      // Get message for visitor's language
      const lang = context.language || 'es';
      let message;
      if (trigger.customMessage) {
        message = trigger.customMessage[lang] || trigger.customMessage.es || trigger.customMessage.en;
      } else if (trigger.message) {
        message = trigger.message(lang, context);
      }
      if (!message) continue;

      // Set cooldown
      await redis.set(cooldownKey, '1', trigger.cooldownSec);

      triggered.push({ trigger: name, message, priority: trigger.priority || 0 });
    } catch (e) {
      logger.warn(`Proactive trigger ${name} error:`, e.message);
    }
  }

  // Return highest priority trigger only (avoid spamming)
  triggered.sort((a, b) => b.priority - a.priority);
  return triggered[0] || null;
}

module.exports = { evaluateTriggers, TRIGGER_TYPES };
