import { invokeLLM } from '@/lib/llm/router';
import { broadcastAgentLog } from '@/lib/agent/realtime';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AgentState, ParsedJD } from '../state';

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
  console.log('[Node: parseJD] Parsing raw job description via LLM Router...');

  if (!state.rawJD?.trim()) {
    throw new Error('[parseJD] rawJD is empty. Cannot parse.');
  }

  try {
    const rawJson = await invokeLLM({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Parse this job description:\n\n${state.rawJD}`,
      temperature: 0.1,
    });

    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedJD = JSON.parse(cleanJson) as ParsedJD;
    const skills = parsedJD.mandatory_skills?.join(', ') ?? 'None detected';

    if (state.jobId) {
      const supabase = getAdminSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('jobs') as any)
        .update({ parsed_requirements: parsedJD })
        .eq('id', state.jobId);

      if (error) {
        console.error(`[parseJD] Failed to persist parsed JD for job ${state.jobId}: ${error.message}`);
      }

      await broadcastAgentLog(
        state.jobId,
        `✓ [parseJD] JD parsed — Required skills: ${skills}`
      );
    }

    console.log('[Node: parseJD] ✓ JD parsed successfully.');
    return { parsedJD };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[parseJD] Failed: ${msg}`, {
      cause: err instanceof Error ? err : undefined,
    });
  }
}
