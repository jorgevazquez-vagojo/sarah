/**
 * Conversation Domain Model
 * Encapsulates conversation business logic
 */

class Conversation {
  constructor(id, tenantId, sessionId, lang = 'es') {
    this.id = id;
    this.tenantId = tenantId;
    this.sessionId = sessionId;
    this.lang = lang;
    this.messages = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.status = 'active'; // active, closed, escalated
    this.leadId = null;
    this.agentId = null;
    this.score = 0;
  }

  addMessage(role, text, metadata = {}) {
    this.messages.push({
      role,
      text,
      timestamp: new Date(),
      ...metadata,
    });
    this.updatedAt = new Date();
  }

  escalateToAgent(agentId) {
    this.status = 'escalated';
    this.agentId = agentId;
  }

  close() {
    this.status = 'closed';
    this.updatedAt = new Date();
  }

  isActive() {
    return this.status === 'active';
  }

  canBeEscalated() {
    return this.status === 'active' && !this.agentId;
  }

  getMessageCount() {
    return this.messages.length;
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }
}

module.exports = Conversation;
