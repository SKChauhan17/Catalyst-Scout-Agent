import OpenAI from 'openai';
import type { AgentState, ParsedJD } from '../state';

const sambanova = new OpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert technical recruiter assistant. Your job is to parse a raw job description and extract a strict JSON object.

You MUST respond with ONLY a valid JSON object — no markdown fencing, no explanation, no extra text.

The JSON schema is:
{
  "mandatory_skills": ["string"],
  "optional_skills": ["string"],
  "location": "string",
  "max_budget": "string",
  "role_summary": "string"
}

Rules:
- "mandatory_skills": Non-negotiable technical skills explicitly required.
- "optional_skills": Skills listed as "nice to have" or implied.
- "location": Exact location string or "Remote" if not specified.
- "max_budget": Salary/rate mentioned, or "Not specified" if absent.
- "role_summary": A single concise sentence describing the role.`;

export async function parseJDNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: parseJD] Parsing raw job description via SambaNova...');

  if (!state.rawJD || state.rawJD.trim() === '') {
    throw new Error('[parseJD] rawJD is empty. Cannot parse.');
  }

  let parsedJD: ParsedJD | null = null;
  let lastError: Error | null = null;

  // Retry loop with exponential backoff (max 3 attempts)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await sambanova.chat.completions.create({
        model: 'Meta-Llama-3.3-70B-Instruct',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Parse this job description:\n\n${state.rawJD}` },
        ],
        temperature: 0.1, // Low temperature for deterministic JSON output
      });

      const rawJson = completion.choices[0].message.content || '{}';
      const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedJD = JSON.parse(cleanJson) as ParsedJD;
      console.log('[Node: parseJD] ✓ JD parsed successfully.');
      break;
    } catch (err: any) {
      lastError = err;
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(`[Node: parseJD] Attempt ${attempt + 1} failed. Retrying in ${waitMs}ms...`);
      await new Promise(res => setTimeout(res, waitMs));
    }
  }

  if (!parsedJD) {
    throw new Error(`[parseJD] All retries exhausted. Last error: ${lastError?.message}`);
  }

  return { parsedJD };
}
