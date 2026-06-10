/**
 * Lumière Collection — AI Provider Abstraction
 * Supports Cerebras (fast inference), Google Gemini (free), OpenRouter (free models), Ollama (local).
 * Default: Cerebras — llama-3.3-70b. No credit card required for free tier.
 *
 * Setup: set CEREBRAS_API_KEY in .env
 * Get your free key at: https://cloud.cerebras.ai
 */

const DEFAULT_MODEL = 'gpt-oss-120b';

/**
 * Call the configured AI provider with a system prompt + user message.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @returns {Promise<string>} Raw text response
 */
export async function callAI(systemPrompt, userPrompt, maxTokens = 1024) {
  const provider = process.env.AI_PROVIDER || 'cerebras';

  switch (provider) {
    case 'cerebras':
      return callCerebras(systemPrompt, userPrompt, maxTokens);
    case 'gemini':
      return callGemini(systemPrompt, userPrompt, maxTokens);
    case 'openrouter':
      return callOpenRouter(systemPrompt, userPrompt, maxTokens);
    case 'ollama':
      return callOllama(systemPrompt, userPrompt, maxTokens);
    default:
      return callCerebras(systemPrompt, userPrompt, maxTokens);
  }
}

// ─────────────────────────────────────────────────────────────
// CEREBRAS — Fast inference, llama-3.3-70b
// https://cloud.cerebras.ai — free tier available
// ─────────────────────────────────────────────────────────────

async function callCerebras(systemPrompt, userPrompt, maxTokens) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('CEREBRAS_API_KEY not set in .env — get a free key at cloud.cerebras.ai');

  const model = process.env.CEREBRAS_MODEL || DEFAULT_MODEL;

  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.72,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cerebras API error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────
// GOOGLE GEMINI — Free tier, gemini-2.0-flash
// https://aistudio.google.com — no credit card required
// ─────────────────────────────────────────────────────────────

async function callGemini(systemPrompt, userPrompt, maxTokens) {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!key) throw new Error('GOOGLE_AI_STUDIO_API_KEY not set — get a free key at aistudio.google.com');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }], role: 'user' }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.72 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─────────────────────────────────────────────────────────────
// OPENROUTER — Free models (llama, mistral, etc.)
// https://openrouter.ai — some models are permanently $0/token
// ─────────────────────────────────────────────────────────────

async function callOpenRouter(systemPrompt, userPrompt, maxTokens) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set — get a free key at openrouter.ai');

  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lumierecollection.co.za',
      'X-Title': 'Lumière Collection',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────
// OLLAMA — Completely local, no API key, no internet
// Install: https://ollama.ai — then run: ollama pull llama3.2
// ─────────────────────────────────────────────────────────────

async function callOllama(systemPrompt, userPrompt, maxTokens) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.72 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

/**
 * Get the name of the active provider for display.
 * @returns {string}
 */
export function getActiveProvider() {
  const provider = process.env.AI_PROVIDER || 'cerebras';
  const models = {
    cerebras: process.env.CEREBRAS_MODEL || DEFAULT_MODEL,
    gemini: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    openrouter: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    ollama: process.env.OLLAMA_MODEL || 'llama3.2',
  };
  return { provider, model: models[provider] || 'unknown', free: true };
}
