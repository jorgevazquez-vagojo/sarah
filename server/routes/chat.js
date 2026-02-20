const { Router } = require('express');
const { db } = require('../utils/db');
const { isBusinessHours, BUSINESS_LINES } = require('../services/router');
const { getSupportedLanguages } = require('../utils/i18n');
const { asyncRoute } = require('../middleware/error-handler');

const router = Router();

// Widget initialization config
router.get('/config', (_req, res) => {
  res.json({
    isBusinessHours: isBusinessHours(),
    languages: getSupportedLanguages(),
    businessLines: BUSINESS_LINES,
    primaryColor: process.env.PRIMARY_COLOR || '#007fff',
  });
});

// Get conversation history (for reconnecting visitors)
router.get('/history/:visitorId', asyncRoute(async (req, res) => {
  const conv = await db.getActiveConversation(req.params.visitorId);
  if (!conv) return res.json({ messages: [] });
  const messages = await db.getMessages(conv.id);
  res.json({
    conversationId: conv.id,
    state: conv.state,
    language: conv.language,
    businessLine: conv.business_line,
    messages: messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      timestamp: m.created_at,
    })),
  });
}));

module.exports = router;
