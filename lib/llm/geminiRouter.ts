import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

// Static model list ordered by capability — Pro → Flash → lite
// The v0.24 SDK does not expose listModels(); we use a curated priority list.
const GEMINI_MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
  'gemini-pro',
];

export interface GeminiRouterOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

/**
 * Vertical Gemini waterfall: tries models in capability order (Pro → Flash → older).
 * Cascades to the next model on 429 / 500 / 503 errors.
 */
export async function invokeGemini(opts: GeminiRouterOptions): Promise<string> {
  const { systemPrompt, userPrompt, temperature = 0.1 } = opts;
  let lastError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature },
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      if (text?.trim()) {
        console.log(`[geminiRouter] ✓ Success with model: ${modelName}`);
        return text;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('500') || msg.includes('503')) {
        console.warn(`[geminiRouter] ${modelName} failed (${msg.slice(0, 60)}), trying next...`);
        lastError = err instanceof Error ? err : new Error(msg);
        continue;
      }
      throw err; // Non-retryable — propagate immediately
    }
  }

  throw new Error(
    `[geminiRouter] All Gemini models exhausted. Last error: ${lastError?.message}`
  );
}
