const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

const TRANSITIONS = {
  chat_idle:           { start: 'chat_active' },
  chat_active:         { escalate: 'chat_waiting_agent', request_call: 'escalation_pending', close: 'closed' },
  chat_waiting_agent:  { agent_accept: 'chat_active', timeout: 'chat_active', cancel: 'chat_active', close: 'closed' },
  escalation_pending:  { call_start: 'call_connecting', cancel: 'chat_active', close: 'closed' },
  call_connecting:     { connected: 'call_active', failed: 'chat_active', close: 'closed' },
  call_active:         { hangup: 'call_ended', close: 'closed' },
  call_ended:          { resume_chat: 'chat_active', close: 'closed' },
  closed:              {},
};

async function transition(conversationId, event) {
  const conv = await db.getConversation(conversationId);
  if (!conv) throw new Error(`Conversation ${conversationId} not found`);

  const current = conv.state;
  const next = TRANSITIONS[current]?.[event];

  if (!next) {
    logger.warn(`Invalid FSM transition: ${current} + ${event} (conv ${conversationId})`);
    return null;
  }

  const updated = await db.updateConversation(conversationId, {
    state: next,
    ...(next === 'closed' ? { closed_at: new Date().toISOString() } : {}),
  });

  logger.info(`FSM: ${current} -> ${next} (event: ${event}, conv: ${conversationId})`);
  return updated;
}

function getValidEvents(state) {
  return Object.keys(TRANSITIONS[state] || {});
}

module.exports = { transition, getValidEvents, TRANSITIONS };
