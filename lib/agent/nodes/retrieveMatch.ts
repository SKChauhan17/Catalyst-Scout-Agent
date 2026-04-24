import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import type { AgentState, Candidate } from '../state';

// SECURITY: Strictly use ANON KEY for all application runtime Supabase access.
// The SERVICE_ROLE_KEY is forbidden here per AGENTS.md §3.5.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('[Node: retrieveMatch] Loading Supabase/gte-small embedding model...');
    embeddingPipeline = await pipeline('feature-extraction', 'Supabase/gte-small');
    console.log('[Node: retrieveMatch] ✓ Embedding model loaded.');
  }
  return embeddingPipeline;
}

export async function retrieveMatchNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: retrieveMatch] Generating query embedding and running hybrid RPC...');

  if (!state.parsedJD) {
    throw new Error('[retrieveMatch] parsedJD is null. Cannot generate embedding.');
  }

  // Build a rich text representation of the parsed JD for embedding
  const queryText = [
    `Role: ${state.parsedJD.role_summary}`,
    `Mandatory skills: ${state.parsedJD.mandatory_skills.join(', ')}`,
    `Optional skills: ${state.parsedJD.optional_skills.join(', ')}`,
    `Location: ${state.parsedJD.location}`,
    `Budget: ${state.parsedJD.max_budget}`,
  ].join('. ');

  // Generate 384-dimensional vector locally via Supabase/gte-small
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractor = await getEmbeddingPipeline() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await extractor(queryText, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data) as number[];

  // Invoke the match_candidates RPC (hybrid cosine similarity + threshold)
  const { data, error } = await supabase.rpc('match_candidates', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    throw new Error(`[retrieveMatch] Supabase RPC error: ${error.message}`);
  }

  const retrievedCandidates: Candidate[] = data ?? [];
  console.log(`[Node: retrieveMatch] ✓ Retrieved ${retrievedCandidates.length} candidates.`);

  return { retrievedCandidates, currentCandidateIndex: 0 };
}
