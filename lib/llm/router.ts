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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// ============================================================
// Tier 5 — Gemini vertical fallback
// Top 5 text-reasoning models from a live GET /v1beta/models
// call (run 2026-04-25), ordered by capability descending.
// Excludes: TTS, image, robotics, research, and Gemma variants.
// ============================================================
const GEMINI_MODELS = [
  'gemini-3.1-pro-preview',  // Newest — highest reasoning capability
  'gemini-3-pro-preview',    // Previous gen Pro
  'gemini-2.5-pro',          // Latest stable Pro
  'gemini-2.5-flash',        // Fast + highly capable
  'gemini-2.0-flash',        // Proven stable fallback
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
 * Master horizontal waterfall across all 5 provider tiers.
 * - The exact original `req` object is forwarded unchanged to every tier.
 * - On 429 / 5xx / network error, emits a [FALLBACK] log and shifts to the next tier.
 * - Non-retryable errors propagate immediately.
 * - Tier 5 (Gemini) internally cascades through 5 sub-models.
 */
export async function invokeLLM(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    try {
      const result = await tier.invoke(req);
      if (result?.trim()) {
        if (i > 0) {
          // Only log when we've fallen back past Tier 1
          console.log(`[LLM Router] ✓ Response served by Tier ${i + 1}: ${tier.name}`);
        }
        return result;
      }
    } catch (err: unknown) {
      if (isRetryable(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        const nextTier = TIERS[i + 1];
        lastError = err instanceof Error ? err : new Error(msg);

        if (nextTier) {
          console.warn(
            `[LLM Router] [FALLBACK] Tier ${i + 1} (${tier.name}) failed → ${msg.slice(0, 80)}. Shifting to Tier ${i + 2}: ${nextTier.name}...`
          );
        }
        continue;
      }
      // Non-retryable (auth error, bad request, etc.) — re-throw immediately
      throw err;
    }
  }

  throw new Error(
    `[LLM Router] All ${TIERS.length} tiers exhausted. Last error: ${lastError?.message}`
  );
}
