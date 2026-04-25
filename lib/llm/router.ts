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

const REQUEST_TIMEOUT_MS = 30_000;
const GEMINI_MODEL_TIMEOUT_MS = 7_000;

const RETRYABLE_CODES = ['429', '500', '502', '503', '504', 'ECONNRESET', 'ETIMEDOUT', 'timeout'];
const RETRYABLE_PHRASES = ['rate limit', 'temporarily unavailable', 'overloaded', 'network'];
const GEMINI_MODEL_FALLBACK_PATTERNS = [
  '404',
  'not found',
  'not supported',
  'unsupported',
  'unavailable',
] as const;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`[timeout:${label}] Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function isRetryable(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return RETRYABLE_CODES.some((code) => msg.includes(code.toLowerCase()))
    || RETRYABLE_PHRASES.some((phrase) => msg.includes(phrase));
}

function isGeminiRetryable(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return isRetryable(err)
    || GEMINI_MODEL_FALLBACK_PATTERNS.some((pattern) => msg.includes(pattern));
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
// Tier 5 - Gemini vertical fallback
// Ordered by capability descending.
// ============================================================
const GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
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
      const result = await withTimeout(
        model.generateContent(req.userPrompt),
        GEMINI_MODEL_TIMEOUT_MS,
        `Gemini/${modelName}`
      );
      const text = result.response.text();

      if (text?.trim()) {
        console.log(`[LLM Router] SUCCESS Gemini/${modelName}`);
        return text;
      }

      lastError = new Error(`Gemini/${modelName} returned an empty response.`);
      console.warn(`[LLM Router] Gemini/${modelName} returned an empty response, trying next...`);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      if (isGeminiRetryable(err)) {
        console.warn(`[LLM Router] Gemini/${modelName} -> ${msg.slice(0, 80)}, trying next...`);
        lastError = toError(err);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`[LLM Router] All Gemini models exhausted. Last: ${lastError?.message ?? 'No response returned.'}`);
}

// ============================================================
// Tier definitions - horizontal provider waterfall
// ============================================================
type TierName = 'SambaNova' | 'OpenRouter' | 'Groq' | 'Cerebras' | 'Gemini';

interface Tier {
  name: TierName;
  enabled: boolean;
  invoke: (req: LLMRequest) => Promise<string>;
}

const TIERS: Tier[] = [
  {
    name: 'SambaNova',
    enabled: Boolean(process.env.SAMBANOVA_API_KEY),
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
    enabled: Boolean(process.env.OPENROUTER_API_KEY),
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
    enabled: Boolean(process.env.GROQ_API_KEY),
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
    enabled: Boolean(process.env.CEREBRAS_API_KEY),
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
    name: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    invoke: invokeGeminiCascade,
  },
];

/**
 * Master horizontal waterfall across all configured provider tiers.
 * - The same request object is forwarded unchanged to each tier.
 * - Retryable failures and enforced timeouts fall through to the next tier.
 * - Gemini internally performs its own model-level cascade.
 */
export async function invokeLLM(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];

    if (!tier.enabled) {
      console.warn(`[LLM Router] Skipping Tier ${i + 1} (${tier.name}) because its API key is not configured.`);
      continue;
    }

    try {
      const result = await withTimeout(
        tier.invoke(req),
        REQUEST_TIMEOUT_MS,
        `Tier ${i + 1} (${tier.name})`
      );

      if (result.trim().length > 0) {
        console.log(`[LLM Router] SUCCESS Tier ${i + 1} (${tier.name}) fulfilled the request.`);
        return result;
      }

      lastError = new Error(`Tier ${i + 1} (${tier.name}) returned an empty response.`);
      console.warn(`[LLM Router] Tier ${i + 1} (${tier.name}) returned an empty response. Trying next...`);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      const isTimeout = msg.includes('[timeout:');

      if (isRetryable(err) || isTimeout) {
        lastError = toError(err);

        if (i + 1 < TIERS.length) {
          console.warn(
            `[LLM Router] [FALLBACK] Tier ${i + 1} (${tier.name}) ${isTimeout ? 'timed out' : 'failed'} -> ${msg.slice(0, 80)}. Shifting to Tier ${i + 2}: ${TIERS[i + 1].name}...`
          );
        }
        continue;
      }

      throw err;
    }
  }

  throw new Error(
    `[LLM Router] All configured tiers exhausted. Last error: ${lastError?.message ?? 'No provider returned content.'}`
  );
}
