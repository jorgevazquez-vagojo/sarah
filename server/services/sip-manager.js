const { logger } = require('../utils/logger');

let ami = null;

function connect() {
  if (!process.env.ASTERISK_AMI_HOST) {
    logger.info('Asterisk AMI not configured, SIP manager disabled');
    return;
  }

  try {
    const AsteriskManager = require('asterisk-manager');
    ami = new AsteriskManager(
      parseInt(process.env.ASTERISK_AMI_PORT || '5038'),
      process.env.ASTERISK_AMI_HOST,
      process.env.ASTERISK_AMI_USER || 'chatbot',
      process.env.ASTERISK_AMI_PASSWORD || '',
      true // auto-reconnect
    );

    ami.keepConnected();

    ami.on('connect', () => logger.info('Asterisk AMI connected'));
    ami.on('error', (err) => logger.error('Asterisk AMI error:', err));

    ami.on('managerevent', (event) => {
      if (event.event === 'QueueMemberStatus') {
        logger.debug(`Queue member ${event.membername}: ${event.status}`);
      }
    });
  } catch (e) {
    logger.warn('Failed to connect to Asterisk AMI:', e.message);
  }
}

function getQueueStatus(queueName) {
  return new Promise((resolve, reject) => {
    if (!ami) return resolve({ members: [], callers: 0 });
    ami.action({
      action: 'QueueStatus',
      queue: queueName,
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function originateCall({ channel, context, exten, callerID, variables }) {
  return new Promise((resolve, reject) => {
    if (!ami) return reject(new Error('AMI not connected'));
    ami.action({
      action: 'Originate',
      channel,
      context: context || 'from-chatbot',
      exten: exten || 's',
      priority: 1,
      callerid: callerID || 'Chatbot <0000>',
      variable: variables ? Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(',') : undefined,
      async: 'true',
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function generateSipCredentials(visitorId) {
  // Generate temporary SIP credentials for WebRTC
  const extension = `visitor-${visitorId.slice(0, 8)}`;
  const password = require('crypto').randomBytes(16).toString('hex');
  return {
    extension,
    password,
    domain: process.env.SIP_DOMAIN || 'pbx.redegal.com',
    wssUrl: process.env.SIP_WSS_URL || 'wss://pbx.redegal.com:8089/ws',
  };
}

module.exports = { connect, getQueueStatus, originateCall, generateSipCredentials };
