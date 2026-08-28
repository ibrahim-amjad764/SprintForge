// lib/openai.ts
import OpenAI from 'openai';

/*
OpenAI Client
Central configuration
for AI features.
*/

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
