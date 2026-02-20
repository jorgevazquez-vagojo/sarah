/**
 * Asterisk AMI Client — Click2Call via callback
 *
 * Flow:
 *   1. Visitor enters phone number in widget
 *   2. Server sends AMI Originate: Asterisk calls visitor phone
 *   3. When visitor answers, Asterisk bridges to target extension
 *   4. CallerID on internal leg: "Lead Web <phone>"
 */

const net = require('net');
const { EventEmitter } = require('events');
const { logger } = require('../utils/logger');
const settings = require('./settings');

class AsteriskAMI extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.buffer = '';
    this.actionIdCounter = 0;
    this.pendingActions = new Map();
    this.reconnectTimer = null;
  }

  async connect() {
    const cfg = await settings.getMany(['ami.host', 'ami.port', 'ami.user', 'ami.password']);
    const host = cfg['ami.host'];
    const port = parseInt(cfg['ami.port'] || '5038', 10);
    const user = cfg['ami.user'] || 'chatbot';
    const password = cfg['ami.password'];

    if (!host || !password) {
      logger.warn('AMI: ami.host or ami.password not configured — Click2Call disabled');
      return;
    }

    this.socket = net.createConnection({ host, port }, () => {
      logger.info(`AMI: Connected to ${host}:${port}`);
    });

    this.socket.setEncoding('utf8');

    this.socket.on('data', (data) => {
      this.buffer += data;
      this.processBuffer();
    });

    this.socket.on('close', () => {
      this.connected = false;
      logger.warn('AMI: Connection closed');
      this.scheduleReconnect();
    });

    this.socket.on('error', (err) => {
      logger.error('AMI: Socket error:', err.message);
    });

    // Login after receiving banner
    this.once('banner', () => {
      this.sendAction({
        Action: 'Login',
        Username: user,
        Secret: password,
      }).then((res) => {
        if (res.Response === 'Success') {
          this.connected = true;
          logger.info('AMI: Authenticated successfully');
          this.emit('ready');
        } else {
          logger.error('AMI: Authentication failed:', res.Message);
          this.socket.destroy();
        }
      }).catch((e) => {
        logger.error('AMI: Login error:', e.message);
      });
    });
  }

  processBuffer() {
    // AMI packets are separated by \r\n\r\n
    const packets = this.buffer.split('\r\n\r\n');
    this.buffer = packets.pop() || '';

    for (const packet of packets) {
      if (!packet.trim()) continue;
      const lines = packet.split('\r\n');

      // First line might be the banner
      if (lines[0].startsWith('Asterisk Call Manager')) {
        this.emit('banner');
        continue;
      }

      const obj = {};
      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const key = line.substring(0, idx).trim();
          const val = line.substring(idx + 1).trim();
          obj[key] = val;
        }
      }

      // Resolve pending action
      if (obj.ActionID && this.pendingActions.has(obj.ActionID)) {
        const { resolve } = this.pendingActions.get(obj.ActionID);
        this.pendingActions.delete(obj.ActionID);
        resolve(obj);
      }

      // Emit events
      if (obj.Event) {
        this.emit('event', obj);
        this.emit(`event:${obj.Event}`, obj);
      }
    }
  }

  sendAction(action) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('AMI not connected'));
        return;
      }

      const actionId = `chatbot-${++this.actionIdCounter}`;
      action.ActionID = actionId;

      const timeout = setTimeout(() => {
        this.pendingActions.delete(actionId);
        reject(new Error('AMI action timeout'));
      }, 10000);

      this.pendingActions.set(actionId, {
        resolve: (res) => { clearTimeout(timeout); resolve(res); },
        reject,
      });

      let msg = '';
      for (const [key, val] of Object.entries(action)) {
        msg += `${key}: ${val}\r\n`;
      }
      msg += '\r\n';
      this.socket.write(msg);
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      logger.info('AMI: Reconnecting...');
      this.connect();
    }, 5000);
  }

  /**
   * Click2Call: Originate a callback call
   *
   * @param {string} visitorPhone - Visitor's phone number (E.164 or national)
   * @param {object} options
   * @param {string} options.callId - Unique call identifier
   * @param {string} options.extension - PBX extension to ring
   * @param {string} options.businessLine - Business line for CallerID
   * @param {string} options.visitorName - Visitor name (from lead form)
   * @param {string} options.context - Asterisk dial plan context
   */
  async originate({ visitorPhone, callId, extension, businessLine, visitorName, context }) {
    if (!this.connected) {
      throw new Error('AMI not connected');
    }

    // Sanitize phone: keep only digits and leading +
    const phone = visitorPhone.replace(/[^\d+]/g, '');
    if (phone.length < 6) {
      throw new Error('Invalid phone number');
    }

    const c2cCfg = await settings.getMany(['click2call.extension', 'click2call.context', 'click2call.trunk']);
    const targetExtension = extension || c2cCfg['click2call.extension'] || '100';
    const dialContext = context || c2cCfg['click2call.context'] || 'from-internal';
    const trunk = c2cCfg['click2call.trunk'] || 'PJSIP/trunk';
    const callerIdName = visitorName
      ? `Lead Web - ${visitorName}`
      : businessLine
        ? `Lead Web - ${businessLine}`
        : 'Lead Web';
    const callerIdNum = phone;

    // Originate: call visitor's phone, when they answer bridge to extension
    const result = await this.sendAction({
      Action: 'Originate',
      Channel: `${trunk}/${phone}`,
      Context: dialContext,
      Exten: targetExtension,
      Priority: '1',
      CallerID: `"${callerIdName}" <${callerIdNum}>`,
      Timeout: '30000',
      Async: 'true',
      Variable: `CALL_ID=${callId},BUSINESS_LINE=${businessLine || 'general'},LEAD_WEB=1`,
    });

    if (result.Response !== 'Success') {
      throw new Error(result.Message || 'Originate failed');
    }

    logger.info(`AMI: Originate call ${callId} — ${phone} → ext ${targetExtension} [${callerIdName}]`);
    return { success: true, callId };
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) this.socket.destroy();
  }
}

// Singleton
const ami = new AsteriskAMI();

async function initAMI() {
  const cfg = await settings.getMany(['ami.host', 'ami.password']);
  if (cfg['ami.host'] && cfg['ami.password']) {
    await ami.connect();

    // Track call events for analytics
    ami.on('event:OriginateResponse', (evt) => {
      logger.info(`AMI: OriginateResponse — ${evt.Response} (${evt.Uniqueid})`);
    });

    ami.on('event:Hangup', (evt) => {
      if (evt.Variable_CALL_ID) {
        logger.info(`AMI: Hangup — callId=${evt.Variable_CALL_ID}, cause=${evt.Cause}`);
      }
    });
  } else {
    logger.warn('AMI: Not configured — set ami.host and ami.password via Setup or .env to enable Click2Call');
  }
}

module.exports = { ami, initAMI };
