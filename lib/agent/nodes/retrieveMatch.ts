import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';

// VERCEL FIX: Force WASM backend and disable local model loading for serverless compatibility
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
import { broadcastAgentLog } from '@/lib/agent/realtime';
import { invokeLLM } from '@/lib/llm/router';
import type { AgentState, Candidate, CustomCandidate, ParsedJD } from '../state';

// SECURITY: Strictly use ANON KEY for all application runtime Supabase access.
// The SERVICE_ROLE_KEY is forbidden here per AGENTS.md §3.5.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const BYOD_FILTER_SYSTEM_PROMPT = `You are an expert technical recruiter. You will receive:
1. A parsed job description JSON object.
2. A JSON array of custom candidate profiles.

Your task is to select the best 5 candidates for the role.

Respond with ONLY a valid JSON array of up to 5 objects using this exact schema:
[
  {
    "id": "candidate-id",
    "similarity": 0.0,
    "system_prompt_persona": "2-4 sentence candidate persona for interview simulation"
  }
]

Rules:
- "id" must exactly match an input candidate id.
- "similarity" must be a decimal between 0 and 1.
- Sort from strongest fit to weakest fit.
- Use skills, experience, location, and salary expectation to judge fit.
- The persona must sound like a real candidate and incorporate their experience and likely communication style.
- No markdown, no explanation, no extra keys.`;

interface RankedCustomCandidate {
  id: string;
  similarity: number | string;
  system_prompt_persona: string;
}

let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('[Node: retrieveMatch] Loading Supabase/gte-small embedding model...');
    embeddingPipeline = await pipeline('feature-extraction', 'Supabase/gte-small');
    console.log('[Node: retrieveMatch] ✓ Embedding model loaded.');
  }
  return embeddingPipeline;
}

function cleanJson(raw: string): string {
  return raw.replace(/```json/g, '').replace(/```/g, '').trim();
}

function clampSimilarity(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function buildFallbackPersona(candidate: CustomCandidate): string {
  const experience = candidate.experience || 'an unspecified amount of experience';
  return `${candidate.name} is a software engineering candidate with ${experience}. Their background centers on ${candidate.skills.join(', ')} and they tend to communicate in a pragmatic, concise way. They are currently based in ${candidate.location} and are evaluating roles around ${candidate.salary_expectation}.`;
}

function mapCustomCandidateToGraphCandidate(
  candidate: CustomCandidate,
  similarity: number,
  systemPromptPersona?: string
): Candidate {
  return {
    id: candidate.id,
    name: candidate.name,
    skills: candidate.skills,
    location: candidate.location,
    salary_expectation: candidate.salary_expectation,
    system_prompt_persona: systemPromptPersona?.trim() || buildFallbackPersona(candidate),
    similarity: parseFloat(clampSimilarity(similarity).toFixed(3)),
  };
}

function scoreCandidateHeuristically(candidate: CustomCandidate, parsedJD: ParsedJD): number {
  const candidateSkills = new Set(candidate.skills.map((skill) => skill.toLowerCase()));
  const mandatorySkills = parsedJD.mandatory_skills.map((skill) => skill.toLowerCase());
  const optionalSkills = parsedJD.optional_skills.map((skill) => skill.toLowerCase());

  const mandatoryMatches = mandatorySkills.filter((skill) => candidateSkills.has(skill)).length;
  const optionalMatches = optionalSkills.filter((skill) => candidateSkills.has(skill)).length;
  const mandatoryScore = mandatorySkills.length > 0 ? mandatoryMatches / mandatorySkills.length : 0.5;
  const optionalScore = optionalSkills.length > 0 ? optionalMatches / optionalSkills.length : 0;

  const locationText = `${candidate.location} ${candidate.experience}`.toLowerCase();
  const locationScore =
    parsedJD.location.toLowerCase() === 'remote'
    || locationText.includes(parsedJD.location.toLowerCase())
      ? 1
      : 0;

  return clampSimilarity((mandatoryScore * 0.75) + (optionalScore * 0.15) + (locationScore * 0.1));
}

function fallbackCustomCandidateMatches(
  customCandidates: CustomCandidate[],
  parsedJD: ParsedJD
): Candidate[] {
  return [...customCandidates]
    .map((candidate) => ({
      candidate,
      score: scoreCandidateHeuristically(candidate, parsedJD),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ candidate, score }) =>
      mapCustomCandidateToGraphCandidate(candidate, score)
    );
}

async function retrieveCustomMatches(
  customCandidates: CustomCandidate[],
  parsedJD: ParsedJD
): Promise<Candidate[]> {
  console.log(
    `[Node: retrieveMatch] BYOD mode detected. Filtering ${customCandidates.length} in-memory candidates via LLM...`
  );

  const raw = await invokeLLM({
    systemPrompt: BYOD_FILTER_SYSTEM_PROMPT,
    userPrompt: `Parsed JD JSON:\n${JSON.stringify(parsedJD, null, 2)}\n\nCustom Candidates JSON:\n${JSON.stringify(customCandidates, null, 2)}`,
    temperature: 0.1,
  });

  const ranked = JSON.parse(cleanJson(raw)) as RankedCustomCandidate[];
  const candidateMap = new Map(customCandidates.map((candidate) => [candidate.id, candidate]));
  const seenIds = new Set<string>();

  const retrievedCandidates = ranked.flatMap((entry) => {
    const sourceCandidate = candidateMap.get(entry.id);
    if (!sourceCandidate || seenIds.has(entry.id)) {
      return [];
    }

    seenIds.add(entry.id);
    return [
      mapCustomCandidateToGraphCandidate(
        sourceCandidate,
        typeof entry.similarity === 'string' ? Number(entry.similarity) : entry.similarity,
        entry.system_prompt_persona
      ),
    ];
  });

  if (retrievedCandidates.length === 0) {
    throw new Error('[retrieveMatch] LLM returned no usable BYOD candidates.');
  }

  return retrievedCandidates.slice(0, 5);
}

async function retrieveSupabaseMatches(parsedJD: ParsedJD): Promise<Candidate[]> {
  console.log('[Node: retrieveMatch] Generating query embedding and running hybrid RPC...');

  const queryText = [
    `Role: ${parsedJD.role_summary}`,
    `Mandatory skills: ${parsedJD.mandatory_skills.join(', ')}`,
    `Optional skills: ${parsedJD.optional_skills.join(', ')}`,
    `Location: ${parsedJD.location}`,
    `Budget: ${parsedJD.max_budget}`,
  ].join('. ');

  // Generate 384-dimensional vector locally via Supabase/gte-small
  const extractor = await getEmbeddingPipeline();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = await extractor(queryText, { pooling: 'mean', normalize: true } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryEmbedding = Array.from((output as any).data) as number[];

  const { data, error } = await supabase.rpc('match_candidates', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    throw new Error(`[retrieveMatch] Supabase RPC error: ${error.message}`);
  }

  return data ?? [];
}

export async function retrieveMatchNode(state: AgentState): Promise<Partial<AgentState>> {
  if (!state.parsedJD) {
    throw new Error('[retrieveMatch] parsedJD is null. Cannot retrieve candidates.');
  }

  let retrievedCandidates: Candidate[];

  if (state.customCandidates.length > 0) {
    try {
      retrievedCandidates = await retrieveCustomMatches(state.customCandidates, state.parsedJD);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Node: retrieveMatch] BYOD LLM filter failed. Falling back to heuristic ranking. ${message}`);
      retrievedCandidates = fallbackCustomCandidateMatches(state.customCandidates, state.parsedJD);
    }
  } else {
    retrievedCandidates = await retrieveSupabaseMatches(state.parsedJD);
  }

  console.log(`[Node: retrieveMatch] ✓ Retrieved ${retrievedCandidates.length} candidates.`);

  if (state.jobId) {
    await broadcastAgentLog(
      state.jobId,
      state.customCandidates.length > 0
        ? `✓ [retrieveMatch] ${retrievedCandidates.length} candidates selected from the BYOD dataset`
        : `✓ [retrieveMatch] ${retrievedCandidates.length} candidates retrieved via hybrid search`
    );
  }

  return { retrievedCandidates, currentCandidateIndex: 0 };
}
