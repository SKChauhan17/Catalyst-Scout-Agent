import { broadcastAgentLog } from '@/lib/agent/realtime';
import { invokeLLM } from '@/lib/llm/router';
import type { AgentState, ChatTurn } from '../state';

function buildConversationPrompt(transcript: ChatTurn[]): string {
  return [
    'Continue this recruiter and candidate interview simulation.',
    'Conversation so far:',
    transcript
      .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
      .join('\n\n'),
    "Respond with ONLY the candidate's next message as plain text. Do not add labels, quotes, or markdown.",
  ].join('\n\n');
}

export async function simulateChatNode(state: AgentState): Promise<Partial<AgentState>> {
  const { retrievedCandidates, parsedJD, currentCandidateIndex } = state;
  const candidate = retrievedCandidates[currentCandidateIndex];

  console.log(`[Node: simulateChat] Simulating 3-turn interview for candidate: ${candidate.name} (index ${currentCandidateIndex})...`);

  if (!parsedJD) {
    throw new Error('[simulateChat] parsedJD is null. Cannot build simulation prompt.');
  }

  // System prompt for the Candidate persona
  const candidateSystemPrompt = `You are playing the role of a software engineering job candidate named ${candidate.name}.
Your technical background, personality, and communication style are defined by this persona:
"${candidate.system_prompt_persona}"

You are currently in a job interview for the following role:
- Role Summary: ${parsedJD.role_summary}
- Required Skills: ${parsedJD.mandatory_skills.join(', ')}
- Location: ${parsedJD.location}
- Budget: ${parsedJD.max_budget}

Respond authentically as this candidate would. Be concise (2-4 sentences per turn). Reveal your genuine interest level or hesitations naturally based on your persona.`;

  // Recruiter's opening pitch
  const recruiterOpener = `Hi ${candidate.name}! I'm reaching out about an exciting ${parsedJD.role_summary} role. It requires ${parsedJD.mandatory_skills.slice(0, 3).join(', ')} — all skills that match your background. The budget is ${parsedJD.max_budget} and it's a ${parsedJD.location} position. Are you open to discussing this opportunity?`;

  const transcript: ChatTurn[] = [
    { role: 'recruiter', content: recruiterOpener },
  ];

  // Drive each turn through the shared time-aware 9-tier invokeLLM waterfall.
  for (let turn = 0; turn < 2; turn++) {
    const candidateMsg = (await invokeLLM({
      systemPrompt: candidateSystemPrompt,
      userPrompt: buildConversationPrompt(transcript),
      temperature: 0.7,
    })).trim();

    transcript.push({ role: 'candidate', content: candidateMsg });

    // Recruiter follow-up (only before the final candidate response)
    if (turn === 0) {
      const recruiterFollowUp = `That's great to hear! Can you tell me a bit about your experience with ${parsedJD.mandatory_skills[0] ?? 'the core tech stack'} and what your ideal next step looks like?`;
      transcript.push({ role: 'recruiter', content: recruiterFollowUp });
    }
  }

  console.log(`[Node: simulateChat] ✓ 3-turn transcript complete for ${candidate.name}.`);

  if (state.jobId) {
    await broadcastAgentLog(
      state.jobId,
      `💬 [simulateChat] Interview simulation ${currentCandidateIndex + 1} complete for ${candidate.name}`
    );
  }

  // Write the transcript into the evaluations array for this candidate
  // (rankCandidates will read it and compute the final scores)
  const partialEvaluation = {
    candidate_id: candidate.id,
    match_score: candidate.similarity,
    interest_score: 0,   // populated by rankCandidates node
    final_score: 0,      // populated by rankCandidates node
    chat_transcript: transcript,
  };

  return {
    evaluations: [partialEvaluation],
  };
}
