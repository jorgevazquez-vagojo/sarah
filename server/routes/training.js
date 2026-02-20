const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { getTrainingStats, getResponsesForReview, submitFeedback } = require('../services/learning');
const { getScrapeHistory, runScrape, embedExistingKnowledge } = require('../services/kb-scraper');

const router = Router();

// All training routes require agent auth
router.use(requireAgent);

// ─── Training stats ───
router.get('/stats', asyncRoute(async (_req, res) => {
  const stats = await getTrainingStats();
  res.json(stats);
}));

// ─── List responses for review ───
router.get('/responses', asyncRoute(async (req, res) => {
  const { feedback, businessLine, language, limit, offset } = req.query;
  const responses = await getResponsesForReview({
    feedback: feedback || undefined,
    businessLine: businessLine || undefined,
    language: language || undefined,
    limit: parseInt(limit) || 20,
    offset: parseInt(offset) || 0,
  });
  res.json(responses);
}));

// ─── Submit feedback for a response ───
router.post('/responses/:id/feedback', asyncRoute(async (req, res) => {
  const { feedback, correctedResponse, notes } = req.body;
  if (!feedback || !['good', 'bad'].includes(feedback)) {
    return res.status(400).json({ error: 'feedback must be "good" or "bad"' });
  }
  const ok = await submitFeedback({
    feedbackId: req.params.id,
    feedback,
    correctedResponse,
    notes,
    agentId: req.agent.id,
  });
  res.json({ success: ok });
}));

// ─── Scrape history ───
router.get('/scrape-history', asyncRoute(async (req, res) => {
  const history = await getScrapeHistory(parseInt(req.query.limit) || 50);
  res.json(history);
}));

// ─── Trigger manual scrape ───
router.post('/scrape', asyncRoute(async (_req, res) => {
  const result = await runScrape();
  res.json(result);
}));

// ─── Trigger embedding of existing KB entries ───
router.post('/embed-kb', asyncRoute(async (_req, res) => {
  await embedExistingKnowledge();
  res.json({ success: true });
}));

module.exports = router;
