import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI, type RequestOptions as GeminiRequestOptions } from '@google/generative-ai';

// ============================================================
// Shared request shape
// ============================================================
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

type TierName =
  | 'SambaNova'
  | 'OpenRouter'
  | 'Groq'
  | 'Cerebras'
  | 'Gemini 3.1 Pro Preview'
  | 'Gemini 3 Pro Preview'
  | 'Gemini 2.5 Pro'
  | 'Gemini 2.5 Flash'
  | 'Gemini 2.0 Flash';

type ProviderName = 'SambaNova' | 'OpenRouter' | 'Groq' | 'Cerebras' | 'Gemini';

type GeminiModelName =
  | 'gemini-3.1-pro-preview'
  | 'gemini-3-pro-preview'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash';

export interface LLMRouterAttempt {
  tier: TierName;
  provider: ProviderName;
  model: string;
  durationMs: number;
  status: 'failed' | 'skipped';
  statusCode?: number;
  rateLimited: boolean;
  message: string;
}

export interface StructuredLLMError {
  type: 'llm_router_error' | 'application_error';
  code: 'LLM_WATERFALL_EXHAUSTED' | 'APPLICATION_ERROR';
  message: string;
  fastPathedToGeminiFlash: boolean;
  lastError?: string;
  attempts?: LLMRouterAttempt[];
}

export class LLMRouterError extends Error {
  readonly structured: StructuredLLMError;

  constructor(structured: StructuredLLMError) {
    super(structured.message);
    this.name = 'LLMRouterError';
    this.structured = structured;
  }

  toJSON(): StructuredLLMError {
    return this.structured;
  }
}

const TOTAL_EXECUTION_BUDGET_MS = 12_000;
const FAST_FAIL_TIER_TIMEOUT_MS = 1_500;
const POWERHOUSE_JUMP_MS = 6_000;
const EMERGENCY_JUMP_MS = 10_000;
const GEMINI_API_VERSION = 'v1beta';
const GEMINI_API_CLIENT = 'catalyst-scout-waterfall/9-tier';

const POWERHOUSE_START_INDEX = 4;
const SAFETY_NET_INDEX = 8;

const RETRYABLE_CODES = ['400', '401', '402', '403', '404', '429', '500', '502', '503', '504', 'ECONNRESET', 'ETIMEDOUT', 'timeout'];
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

function extractStatusCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }

  const record = err as Record<string, unknown>;

  if (typeof record.status === 'number') {
    return record.status;
  }

  if (typeof record.statusCode === 'number') {
    return record.statusCode;
  }

  if (
    typeof record.response === 'object'
    && record.response !== null
    && typeof (record.response as Record<string, unknown>).status === 'number'
  ) {
    return (record.response as Record<string, unknown>).status as number;
  }

  if (record.code === 429 || record.code === '429') {
    return 429;
  }

  return undefined;
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

function isRateLimitError(err: unknown): boolean {
  const statusCode = extractStatusCode(err);
  if (statusCode === 429) {
    return true;
  }

  const msg = errorMessage(err).toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests');
}

function isTimeoutError(err: unknown): boolean {
  return errorMessage(err).includes('[timeout:');
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

function resolveTierIndex(currentIndex: number, elapsedMs: number): number {
  if (elapsedMs >= EMERGENCY_JUMP_MS && currentIndex < SAFETY_NET_INDEX) {
    return SAFETY_NET_INDEX;
  }

  if (elapsedMs >= POWERHOUSE_JUMP_MS && currentIndex < POWERHOUSE_START_INDEX) {
    return POWERHOUSE_START_INDEX;
  }

  return currentIndex;
}

function getTierTimeoutMs(tierIndex: number, elapsedMs: number): number {
  const remainingBudgetMs = TOTAL_EXECUTION_BUDGET_MS - elapsedMs;

  if (remainingBudgetMs <= 0) {
    return 0;
  }

  if (tierIndex < POWERHOUSE_START_INDEX) {
    return Math.min(FAST_FAIL_TIER_TIMEOUT_MS, remainingBudgetMs);
  }

  if (tierIndex < SAFETY_NET_INDEX) {
    return Math.min(
      FAST_FAIL_TIER_TIMEOUT_MS,
      Math.max(1, EMERGENCY_JUMP_MS - elapsedMs),
      remainingBudgetMs
    );
  }

  return remainingBudgetMs;
}

function buildGeminiRequestOptions(timeoutMs: number): GeminiRequestOptions {
  return {
    timeout: timeoutMs,
    apiVersion: GEMINI_API_VERSION,
    apiClient: GEMINI_API_CLIENT,
    customHeaders: {
      'x-catalyst-waterfall': 'latency-optimized',
    },
  };
}

// ============================================================
// Provider clients
// ============================================================
const sambanova = new OpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY ?? '',
  maxRetries: 0,
  timeout: TOTAL_EXECUTION_BUDGET_MS,
});

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  maxRetries: 0,
  timeout: TOTAL_EXECUTION_BUDGET_MS,
  defaultHeaders: {
    'HTTP-Referer': 'https://catalyst-scout.vercel.app',
    'X-Title': 'Catalyst Scout',
  },
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY ?? '',
  maxRetries: 0,
  timeout: TOTAL_EXECUTION_BUDGET_MS,
});

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY ?? '',
  maxRetries: 0,
  timeout: TOTAL_EXECUTION_BUDGET_MS,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

async function invokeGeminiModel(
  req: LLMRequest,
  modelName: GeminiModelName,
  timeoutMs: number
): Promise<string> {
  const requestOptions = buildGeminiRequestOptions(timeoutMs);
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: { temperature: req.temperature ?? 0.1 },
      systemInstruction: req.systemPrompt,
    },
    requestOptions
  );

  const result = await withTimeout(
    model.generateContent(req.userPrompt, requestOptions),
    timeoutMs,
    `Gemini/${modelName}`
  );

  const text = result.response.text();

  if (!text?.trim()) {
    throw new Error(`Gemini/${modelName} returned an empty response.`);
  }

  return text;
}

// ============================================================
// Tier definitions - 9-tier horizontal waterfall
// ============================================================
interface Tier {
  name: TierName;
  provider: ProviderName;
  enabled: boolean;
  model: string;
  invoke: (req: LLMRequest, timeoutMs: number) => Promise<string>;
}

const TIERS: Tier[] = [
  {
    name: 'SambaNova',
    provider: 'SambaNova',
    enabled: Boolean(process.env.SAMBANOVA_API_KEY),
    model: 'Meta-Llama-3.3-70B-Instruct',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }, timeoutMs) => {
      const res = await sambanova.chat.completions.create({
        model: 'Meta-Llama-3.3-70B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }, {
        timeout: timeoutMs,
        maxRetries: 0,
      });

      return res.choices[0]?.message?.content ?? '';
    },
  },
  {
    name: 'OpenRouter',
    provider: 'OpenRouter',
    enabled: Boolean(process.env.OPENROUTER_API_KEY),
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }, timeoutMs) => {
      const res = await openrouter.chat.completions.create({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }, {
        timeout: timeoutMs,
        maxRetries: 0,
      });

      return res.choices[0]?.message?.content ?? '';
    },
  },
  {
    name: 'Groq',
    provider: 'Groq',
    enabled: Boolean(process.env.GROQ_API_KEY),
    model: 'llama-3.3-70b-versatile',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }, timeoutMs) => {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }, {
        timeout: timeoutMs,
        maxRetries: 0,
      });

      return res.choices[0]?.message?.content ?? '';
    },
  },
  {
    name: 'Cerebras',
    provider: 'Cerebras',
    enabled: Boolean(process.env.CEREBRAS_API_KEY),
    model: 'llama3.1-8b',
    invoke: async ({ systemPrompt, userPrompt, temperature = 0.1 }, timeoutMs) => {
      const res = await cerebras.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }, {
        timeout: timeoutMs,
        maxRetries: 0,
      });

      return res.choices[0]?.message?.content ?? '';
    },
  },
  {
    name: 'Gemini 3.1 Pro Preview',
    provider: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.1-pro-preview',
    invoke: (req, timeoutMs) => invokeGeminiModel(req, 'gemini-3.1-pro-preview', timeoutMs),
  },
  {
    name: 'Gemini 3 Pro Preview',
    provider: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3-pro-preview',
    invoke: (req, timeoutMs) => invokeGeminiModel(req, 'gemini-3-pro-preview', timeoutMs),
  },
  {
    name: 'Gemini 2.5 Pro',
    provider: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-2.5-pro',
    invoke: (req, timeoutMs) => invokeGeminiModel(req, 'gemini-2.5-pro', timeoutMs),
  },
  {
    name: 'Gemini 2.5 Flash',
    provider: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-2.5-flash',
    invoke: (req, timeoutMs) => invokeGeminiModel(req, 'gemini-2.5-flash', timeoutMs),
  },
  {
    name: 'Gemini 2.0 Flash',
    provider: 'Gemini',
    enabled: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-2.0-flash',
    invoke: (req, timeoutMs) => invokeGeminiModel(req, 'gemini-2.0-flash', timeoutMs),
  },
];

function buildLLMRouterError(
  attempts: LLMRouterAttempt[],
  lastError: Error | null,
  fastPathedToGeminiFlash: boolean
): LLMRouterError {
  const lastErrorMessage = lastError?.message ?? 'No provider returned content.';

  return new LLMRouterError({
    type: 'llm_router_error',
    code: 'LLM_WATERFALL_EXHAUSTED',
    message: `[LLM Router] All configured tiers exhausted. Last error: ${lastErrorMessage}`,
    fastPathedToGeminiFlash,
    lastError: lastErrorMessage,
    attempts,
  });
}

export function normalizeStructuredError(error: unknown): StructuredLLMError {
  if (error instanceof LLMRouterError) {
    return error.structured;
  }

  if (error instanceof Error && error.cause) {
    const nested = normalizeStructuredError(error.cause);
    return {
      ...nested,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    type: 'application_error',
    code: 'APPLICATION_ERROR',
    message,
    fastPathedToGeminiFlash: false,
  };
}

/**
 * Master 9-tier horizontal waterfall across all configured provider tiers.
 * - Total execution budget is capped at 12 seconds.
 * - Tiers 1-4 fast fail after 1.5 seconds each.
 * - At the 6-second mark, the router jumps straight into the Gemini powerhouse block.
 * - At the 10-second mark, the router jumps directly to Gemini 2.0 Flash.
 */
export async function invokeLLM(req: LLMRequest): Promise<string> {
  let lastError: Error | null = null;
  let fastPathedToGeminiFlash = false;
  const startTimeMs = Date.now();
  const attempts: LLMRouterAttempt[] = [];
  let tierIndex = 0;

  while (tierIndex < TIERS.length) {
    const elapsedMs = Date.now() - startTimeMs;

    if (elapsedMs >= TOTAL_EXECUTION_BUDGET_MS) {
      lastError = new Error(
        `[LLM Router] Exceeded ${TOTAL_EXECUTION_BUDGET_MS}ms execution budget before a provider returned content.`
      );
      break;
    }

    const resolvedTierIndex = resolveTierIndex(tierIndex, elapsedMs);
    if (resolvedTierIndex !== tierIndex) {
      if (resolvedTierIndex === SAFETY_NET_INDEX) {
        fastPathedToGeminiFlash = true;
        console.warn(
          `[LLM Router] [TIME SLICE] ${elapsedMs}ms elapsed. Jumping directly to Tier 9 (${TIERS[SAFETY_NET_INDEX].name}).`
        );
      } else if (resolvedTierIndex === POWERHOUSE_START_INDEX) {
        console.warn(
          `[LLM Router] [TIME SLICE] ${elapsedMs}ms elapsed. Jumping to Tier 5 (${TIERS[POWERHOUSE_START_INDEX].name}).`
        );
      }

      tierIndex = resolvedTierIndex;
    }

    const tier = TIERS[tierIndex];

    if (!tier.enabled) {
      console.warn(`[LLM Router] Skipping ${tier.name} because its API key is not configured.`);
      attempts.push({
        tier: tier.name,
        provider: tier.provider,
        model: tier.model,
        durationMs: 0,
        status: 'skipped',
        rateLimited: false,
        message: 'API key is not configured.',
      });
      tierIndex += 1;
      continue;
    }

    const attemptTimeoutMs = getTierTimeoutMs(tierIndex, Date.now() - startTimeMs);
    if (attemptTimeoutMs <= 0) {
      lastError = new Error('[LLM Router] No execution budget remained for the next tier.');
      break;
    }

    const attemptStartedAt = Date.now();

    try {
      const result = await tier.invoke(req, attemptTimeoutMs);

      if (result.trim().length > 0) {
        console.log(`[LLM Router] SUCCESS ${tier.name} fulfilled the request.`);
        return result;
      }

      lastError = new Error(`${tier.name} returned an empty response.`);
      attempts.push({
        tier: tier.name,
        provider: tier.provider,
        model: tier.model,
        durationMs: Date.now() - attemptStartedAt,
        status: 'failed',
        rateLimited: false,
        message: lastError.message,
      });
      console.warn(`[LLM Router] ${tier.name} returned an empty response. Trying next tier...`);
      tierIndex += 1;
    } catch (err: unknown) {
      const message = errorMessage(err);
      const rateLimited = isRateLimitError(err);
      const statusCode = extractStatusCode(err);
      const attemptDurationMs = Date.now() - attemptStartedAt;
      const classifiedAsFallback =
        statusCode !== undefined
        || isTimeoutError(err)
        || (tier.provider === 'Gemini' ? isGeminiRetryable(err) : isRetryable(err));

      attempts.push({
        tier: tier.name,
        provider: tier.provider,
        model: tier.model,
        durationMs: attemptDurationMs,
        status: 'failed',
        statusCode,
        rateLimited,
        message,
      });

      lastError = toError(err);

      const nextTierIndex = tierIndex + 1;
      const resolvedNextTierIndex = resolveTierIndex(
        nextTierIndex,
        Date.now() - startTimeMs
      );

      if (!classifiedAsFallback) {
        console.warn(
          `[LLM Router] [UNCLASSIFIED PROVIDER ERROR] ${tier.name} threw a non-standard error shape; continuing for availability.`
        );
      }

      console.warn(
        `[LLM Router] [TERMINAL TIER ERROR] ${tier.name} -> ${message.slice(0, 180)}`
      );

      if (resolvedNextTierIndex < TIERS.length) {
        console.warn(
          `[LLM Router] [FALLBACK] ${tier.name} ${rateLimited ? 'rate limited' : 'failed'} -> ${message.slice(0, 100)}. Shifting to ${TIERS[resolvedNextTierIndex].name}...`
        );
      }

      tierIndex = resolvedNextTierIndex;
      continue;
    }
  }

  throw buildLLMRouterError(attempts, lastError, fastPathedToGeminiFlash);
}
