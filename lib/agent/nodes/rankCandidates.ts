import { broadcastAgentLog, broadcastAgentResult } from '@/lib/agent/realtime';
import { invokeLLM } from '@/lib/llm/router';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AgentState, CandidateEvaluation, EvaluatedCandidate } from '../state';

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
  const { evaluations, currentCandidateIndex, retrievedCandidates } = state;
  const latestEval = evaluations[evaluations.length - 1];

  if (!latestEval) {
    throw new Error('[rankCandidates] No evaluation found to score.');
  }

  console.log(`[Node: rankCandidates] Scoring candidate ${latestEval.candidate_id}...`);

  const transcriptText = latestEval.chat_transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n\n');

  let interest_score = 50;
  let reasoning = 'Scoring model did not return parseable output.';

  try {
    const raw = await invokeLLM({
      systemPrompt: SCORING_SYSTEM_PROMPT,
      userPrompt: `Rate this transcript:\n\n${transcriptText}`,
      temperature: 0.1,
    });
    const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
    interest_score = Math.min(100, Math.max(0, parseInt(parsed.interest_score, 10)));
    reasoning = parsed.reasoning ?? reasoning;
  } catch {
    console.warn('[rankCandidates] Failed to parse interest score JSON, using default 50.');
  }

  const normalizedMatchScore = latestEval.match_score * 100;
  const final_score = normalizedMatchScore * 0.6 + interest_score * 0.4;

  const completedEval: CandidateEvaluation = {
    ...latestEval,
    interest_score,
    final_score: parseFloat(final_score.toFixed(2)),
  };

  const candidate = retrievedCandidates[currentCandidateIndex];
  const evaluatedCandidate: EvaluatedCandidate | null = candidate
    ? {
        id: candidate.id,
        name: candidate.name,
        skills: candidate.skills,
        location: candidate.location,
        salary_expectation: candidate.salary_expectation,
        match_score: completedEval.match_score,
        interest_score: completedEval.interest_score,
        final_score: completedEval.final_score,
        chat_transcript: completedEval.chat_transcript,
      }
    : null;

  console.log(
    `[Node: rankCandidates] ✓ ${latestEval.candidate_id} | match: ${normalizedMatchScore.toFixed(1)} | interest: ${interest_score} | final: ${completedEval.final_score} | ${reasoning}`
  );

  if (evaluatedCandidate && state.jobId) {
    const supabase = getAdminSupabaseClient();
    const isCustomCandidate = state.customCandidates.some(
      (customCandidate) => customCandidate.id === evaluatedCandidate.id
    );
    const candidateId =
      !isCustomCandidate
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        evaluatedCandidate.id
      )
        ? evaluatedCandidate.id
        : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('evaluations') as any).insert({
      candidate_id: candidateId,
      job_id: state.jobId,
      match_score: completedEval.match_score,
      interest_score: completedEval.interest_score,
      final_score: completedEval.final_score,
      chat_transcript: completedEval.chat_transcript,
      candidate_snapshot: evaluatedCandidate,
    });

    if (error) {
      console.error(`[rankCandidates] Supabase insert error: ${error.message}`);
      await broadcastAgentLog(
        state.jobId,
        `⚠️ [rankCandidates] ${evaluatedCandidate.name} evaluated, but persistence failed. Continuing with live result delivery.`
      );
    } else {
      await broadcastAgentLog(
        state.jobId,
        `⚡ [rankCandidates] ${evaluatedCandidate.name} — final score: ${completedEval.final_score}`
      );
    }

    await broadcastAgentResult(state.jobId, evaluatedCandidate);
  }

  const updatedEvaluations = [...evaluations.slice(0, -1), completedEval];
  return { evaluations: updatedEvaluations, currentCandidateIndex: currentCandidateIndex + 1 };
}
