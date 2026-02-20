const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');

const PROVIDERS = {
  anthropic: { model: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  gemini:    { model: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash' },
  openai:    { model: 'gpt-4o-mini',              label: 'GPT-4o-mini' },
};

const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const FALLBACK_CHAIN = ['gemini', 'anthropic', 'openai'];

async function getProvider() {
  try {
    const saved = await redis.get('ai:provider');
    if (saved && PROVIDERS[saved]) return saved;
  } catch {}
  return DEFAULT_PROVIDER;
}

// ─── Provider: Anthropic Claude ───
async function anthropicComplete(systemPrompt, userPrompt, options = {}) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: options.model || PROVIDERS.anthropic.model,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.4,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content[0].text;
}

// ─── Provider: Google Gemini ───
async function geminiComplete(systemPrompt, userPrompt, options = {}) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: options.model || PROVIDERS.gemini.model,
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.4,
    },
  });
  return result.response.text();
}

// ─── Provider: OpenAI ───
async function openaiComplete(systemPrompt, userPrompt, options = {}) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: options.model || PROVIDERS.openai.model,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return response.choices[0].message.content;
}

const PROVIDER_FN = {
  anthropic: anthropicComplete,
  gemini:    geminiComplete,
  openai:    openaiComplete,
};

// ─── Router with automatic fallback ───
async function aiComplete(systemPrompt, userPrompt, options = {}) {
  const primary = await getProvider();
  const chain = [primary, ...FALLBACK_CHAIN.filter((p) => p !== primary)];
  const errors = [];

  for (const provider of chain) {
    const fn = PROVIDER_FN[provider];
    if (!fn) continue;
    try {
      const result = await fn(systemPrompt, userPrompt, options);
      if (!result) throw new Error(`${provider} returned empty response`);
      if (provider !== primary) {
        logger.warn(`AI fallback: ${primary} -> ${provider}`);
      }
      return result;
    } catch (e) {
      logger.warn(`AI provider ${provider} failed: ${e.message}`);
      errors.push({ provider, error: e.message });
    }
  }

  throw new Error(`All AI providers failed: ${JSON.stringify(errors)}`);
}

module.exports = { aiComplete, getProvider, PROVIDERS };
