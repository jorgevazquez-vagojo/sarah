/**
 * Business Unit Router
 * Routes conversations to appropriate BU extensions
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let buConfig = null;

function loadConfig() {
  if (buConfig) return buConfig;

  const configPath = path.join(__dirname, '../config/business-units.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  buConfig = yaml.load(configFile);

  return buConfig;
}

function getBusinessUnit(buName) {
  const config = loadConfig();
  if (!config.business_units[buName]) {
    throw new Error(`Unknown business unit: ${buName}`);
  }
  return config.business_units[buName];
}

function getExtensionForBU(buName) {
  const bu = getBusinessUnit(buName);
  return bu.default_extension;
}

function getAllExtensions() {
  const config = loadConfig();
  const extensions = {};
  Object.entries(config.business_units).forEach(([name, bu]) => {
    extensions[name] = bu.extensions;
  });
  return extensions;
}

async function routeConversation(conversation, options = {}) {
  try {
    const buName = conversation.business_line || options.businessLine;
    if (!buName) {
      throw new Error('Business line not specified');
    }

    const bu = getBusinessUnit(buName);
    const extension = options.extension || bu.default_extension;

    logger.info('Routing conversation', {
      conversationId: conversation.id,
      businessUnit: buName,
      extension,
      queue: bu.pbx_queue,
    });

    return {
      extension,
      queue: bu.pbx_queue,
      displayName: bu.display_name,
      skills: bu.skills,
      email: bu.email,
      webhookUrl: bu.webhook_url,
    };
  } catch (err) {
    logger.error('Conversation routing failed', err);
    throw err;
  }
}

async function escalateToAgent(conversation) {
  const routing = await routeConversation(conversation);

  // TODO: Send SIP INVITE to extension via Vozelia
  // TODO: Fire webhook to BU
  // TODO: Add to PBX queue

  return routing;
}

function getAvailableExtensions(buName) {
  const bu = getBusinessUnit(buName);
  return bu.extensions;
}

module.exports = {
  loadConfig,
  getBusinessUnit,
  getExtensionForBU,
  getAllExtensions,
  routeConversation,
  escalateToAgent,
  getAvailableExtensions,
};
