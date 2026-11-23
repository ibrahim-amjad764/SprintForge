// lib/openai.ts
import OpenAI from 'openai';

/*
OpenAI Client
Central configuration
for AI features.
*/

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Optional override for OpenAI-compatible endpoints (Azure, proxies,
  // local LLMs). Undefined → the SDK default api.openai.com.
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export default openai;
