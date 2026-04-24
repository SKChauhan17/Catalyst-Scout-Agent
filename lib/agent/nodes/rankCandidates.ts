import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import type { AgentState, CandidateEvaluation } from '../state';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// SECURITY: Anon key used for runtime reads/writes — evaluations table
// has a service_role insert policy defined in the migration. For the
// hackathon demo, we expose write via RLS; in production scope this
// to authenticated users or a server action with service role.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SCORING_SYSTEM_PROMPT = `You are an expert talent evaluation AI. You will be given a chat transcript from a simulated recruiter/candidate interview.

Your task: Analyze the candidate's responses and assign an integer "interest_score" from 0 to 100.

Scoring rubric:
- 0–25: Candidate showed clear disinterest, mismatch, or negative signals.
- 26–50: Candidate was neutral or non-committal.
- 51–75: Candidate showed genuine curiosity and moderate enthusiasm.
- 76–100: Candidate was highly enthusiastic, well-aligned, and showed strong intent to move forward.

Respond with ONLY a valid JSON object. No markdown, no explanation:
{"interest_score": <integer 0-100>, "reasoning": "<one sentence>"}`;

export async function rankCandidatesNode(state: AgentState): Promise<Partial<AgentState>> {
  const { evaluations, currentCandidateIndex } = state;

  // The most recently appended evaluation is for the current candidate
  const latestEval = evaluations[evaluations.length - 1];

  if (!latestEval) {
    throw new Error('[rankCandidates] No evaluation found to score.');
  }

  console.log(`[Node: rankCandidates] Scoring candidate ${latestEval.candidate_id}...`);

  // Serialize the transcript for the scoring prompt
  const transcriptText = latestEval.chat_transcript
    .map(t => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n\n');

  // Use Groq for fast interest score extraction
  const scoringResponse = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SCORING_SYSTEM_PROMPT },
      { role: 'user', content: `Rate this transcript:\n\n${transcriptText}` },
    ],
    temperature: 0.1,
    max_tokens: 100,
  });

  let interest_score = 50; // Sensible default on parse failure
  let reasoning = 'Scoring model did not return parseable output.';

  try {
    const raw = scoringResponse.choices[0].message.content || '{}';
    const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
    interest_score = Math.min(100, Math.max(0, parseInt(parsed.interest_score, 10)));
    reasoning = parsed.reasoning ?? reasoning;
  } catch {
    console.warn('[rankCandidates] Failed to parse interest score JSON, using default 50.');
  }

  // Final score formula: (match_score * 100 * 0.6) + (interest_score * 0.4)
  // match_score from pgvector is 0–1 (cosine similarity), normalise to 0–100
  const normalizedMatchScore = latestEval.match_score * 100;
  const final_score = (normalizedMatchScore * 0.6) + (interest_score * 0.4);

  const completedEval: CandidateEvaluation = {
    ...latestEval,
    interest_score,
    final_score: parseFloat(final_score.toFixed(2)),
  };

  console.log(
    `[Node: rankCandidates] ✓ ${latestEval.candidate_id} | match: ${normalizedMatchScore.toFixed(1)} | interest: ${interest_score} | final: ${completedEval.final_score} | ${reasoning}`
  );

  // Persist the completed evaluation to Supabase
  const { error } = await supabase.from('evaluations').insert({
    candidate_id: completedEval.candidate_id,
    match_score: completedEval.match_score,
    interest_score: completedEval.interest_score,
    chat_transcript: completedEval.chat_transcript,
  });

  if (error) {
    // Non-fatal: log and continue — the data still lives in state for the UI
    console.error(`[rankCandidates] Supabase insert error: ${error.message}`);
  }

  // Update the evaluation record in state with final scores
  const updatedEvaluations = [...evaluations.slice(0, -1), completedEval];

  return {
    evaluations: updatedEvaluations,
    // Advance the loop pointer to the next candidate
    currentCandidateIndex: currentCandidateIndex + 1,
  };
}
