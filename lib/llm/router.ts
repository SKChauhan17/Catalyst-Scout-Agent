import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { invokeGemini } from './geminiRouter';

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

// ============================================================
// Tier definitions
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
    name: 'Gemini',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }) =>
      invokeGemini({ systemPrompt, userPrompt, temperature }),
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
 * Cascades through all 5 LLM tiers in order.
 * Falls back on 429 / 5xx / network errors only.
 * Propagates non-retryable errors immediately.
 */
export async function invokeLLM(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;

  for (const tier of TIERS) {
    try {
      const result = await tier.invoke(req);
      if (result?.trim()) {
        if (tier.name !== 'SambaNova') {
          console.log(`[LLM Router] ✓ Served by Tier: ${tier.name}`);
        }
        return result;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRetryable(err)) {
        console.warn(
          `[LLM Router] ${tier.name} failed (${msg.slice(0, 80)}). Cascading to next tier...`
        );
        lastError = err instanceof Error ? err : new Error(msg);
        continue;
      }
      // Non-retryable — re-throw immediately
      throw err;
    }
  }

  throw new Error(
    `[LLM Router] All 5 tiers exhausted. Last error: ${lastError?.message}`
  );
}
