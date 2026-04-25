import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================
// Shared request shape
// ============================================================
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

// ============================================================
// Provider clients
// ============================================================
const sambanova = new OpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY ?? '',
});

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://catalyst-scout.vercel.app',
    'X-Title': 'Catalyst Scout',
  },
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' });

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY ?? '',
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

// ============================================================
// Tier 5 — Gemini vertical fallback
// Top 5 models from the Gemini API listed once, ordered by
// capability descending: 2.5-pro → 2.0-flash → 1.5-pro →
// 1.5-flash → 1.0-pro
// Source: https://ai.google.dev/gemini-api/docs/models
// ============================================================
const GEMINI_MODELS = [
  'gemini-2.5-pro-preview-03-25', // Most capable — extended thinking
  'gemini-2.0-flash',             // Fast + capable, latest stable
  'gemini-1.5-pro',               // Long context, high intelligence
  'gemini-1.5-flash',             // Balanced speed/quality
  'gemini-1.0-pro',               // Legacy fallback
] as const;

async function invokeGeminiCascade(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: req.temperature ?? 0.1 },
        systemInstruction: req.systemPrompt,
      });
      const result = await model.generateContent(req.userPrompt);
      const text = result.response.text();
      if (text?.trim()) {
        console.log(`[LLM Router] ✓ Gemini: ${modelName}`);
        return text;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('500') || msg.includes('503')) {
        console.warn(`[LLM Router] Gemini/${modelName} → ${msg.slice(0, 60)}, trying next...`);
        lastError = err instanceof Error ? err : new Error(msg);
        continue;
      }
      throw err; // Non-retryable
    }
  }

  throw new Error(`[LLM Router] All Gemini models exhausted. Last: ${lastError?.message}`);
}

// ============================================================
// Tier definitions — horizontal provider waterfall
// ============================================================
type TierName = 'SambaNova' | 'OpenRouter' | 'Groq' | 'Cerebras' | 'Gemini';

interface Tier {
  name: TierName;
  invoke: (req: LLMRequest) => Promise<string>;
}

const TIERS: Tier[] = [
  {
    name: 'SambaNova',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }) => {
      const res = await sambanova.chat.completions.create({
        model: 'Meta-Llama-3.3-70B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });
      return res.choices[0].message.content ?? '';
    },
  },
  {
    name: 'OpenRouter',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }) => {
      const res = await openrouter.chat.completions.create({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });
      return res.choices[0].message.content ?? '';
    },
  },
  {
    name: 'Groq',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }) => {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });
      return res.choices[0].message.content ?? '';
    },
  },
  {
    name: 'Cerebras',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }) => {
      const res = await cerebras.chat.completions.create({
        model: 'llama3.1-70b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });
      return res.choices[0].message.content ?? '';
    },
  },
  {
    // Tier 5: Gemini vertical cascade (2.5-pro → 2.0-flash → 1.5-pro → 1.5-flash → 1.0-pro)
    name: 'Gemini',
    invoke: invokeGeminiCascade,
  },
];

// ============================================================
// Master horizontal waterfall
// ============================================================
const RETRYABLE_CODES = ['429', '500', '502', '503', 'ECONNRESET', 'timeout'];

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE_CODES.some((code) => msg.includes(code));
}

/**
 * Cascades through all 5 LLM provider tiers in order.
 * Tier 5 (Gemini) itself cascades through 5 sub-models internally.
 * Falls back only on 429 / 5xx / network errors.
 */
export async function invokeLLM(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;

  for (const tier of TIERS) {
    try {
      const result = await tier.invoke(req);
      if (result?.trim()) {
        if (tier.name !== 'SambaNova') {
          console.log(`[LLM Router] ✓ Served by: ${tier.name}`);
        }
        return result;
      }
    } catch (err: unknown) {
      if (isRetryable(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[LLM Router] ${tier.name} failed → ${msg.slice(0, 80)}. Cascading...`);
        lastError = err instanceof Error ? err : new Error(msg);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`[LLM Router] All 5 tiers exhausted. Last: ${lastError?.message}`);
}
