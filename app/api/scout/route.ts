import { catalystScoutGraph } from '@/lib/agent/graph';
import type {
  AgentState,
  Candidate,
  CandidateEvaluation,
  CustomCandidate,
} from '@/lib/agent/state';

export const runtime = 'nodejs';
// Allow up to 5 minutes for the full LangGraph pipeline
export const maxDuration = 300;

interface EvaluatedCandidate {
  id: string;
  name: string;
  skills: string[];
  location: string;
  salary_expectation: string;
  match_score: number;
  interest_score: number;
  final_score: number;
  chat_transcript: Array<{ role: 'recruiter' | 'candidate'; content: string }>;
}

function sanitizeCustomCandidates(input: unknown): CustomCandidate[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return [];
    }

    const record = candidate as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const rawSkills = Array.isArray(record.skills)
      ? record.skills.map((skill) => String(skill).trim()).filter(Boolean)
      : [];

    if (!name || rawSkills.length === 0) {
      return [];
    }

    return [{
      id:
        typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id.trim()
          : `custom-${crypto.randomUUID()}`,
      name,
      skills: rawSkills,
      experience:
        typeof record.experience === 'string' && record.experience.trim().length > 0
          ? record.experience.trim()
          : 'Not specified',
      location:
        typeof record.location === 'string' && record.location.trim().length > 0
          ? record.location.trim()
          : 'Not specified',
      salary_expectation:
        typeof record.salary_expectation === 'string' && record.salary_expectation.trim().length > 0
          ? record.salary_expectation.trim()
          : 'Not specified',
    }];
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();
  const rawJD: string = body?.rawJD?.trim();
  const customCandidates = sanitizeCustomCandidates(body?.customCandidates);

  if (!rawJD) {
    return Response.json({ error: 'rawJD is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        emit('log', { message: '🚀 Initializing Catalyst Scout Agent...' });
        if (customCandidates.length > 0) {
          emit('log', {
            message: `📦 BYOD mode active — ${customCandidates.length} custom candidates loaded into memory.`,
          });
        }

        const initialState: Partial<AgentState> = {
          rawJD,
          parsedJD: null,
          customCandidates,
          retrievedCandidates: [],
          evaluations: [],
          currentCandidateIndex: 0,
        };

        // Collect retrieved candidates for merging with evaluations
        let retrievedCandidates: Candidate[] = [];
        const emittedIds = new Set<string>();

        const graphStream = await catalystScoutGraph.stream(initialState);

        for await (const chunk of graphStream) {
          const [nodeName, nodeOutput] = Object.entries(chunk)[0] as [
            string,
            Partial<AgentState>
          ];

          // Generate a human-readable log per node completion
          if (nodeName === 'parseJD' && nodeOutput.parsedJD) {
            const skills = nodeOutput.parsedJD.mandatory_skills?.join(', ') ?? '';
            emit('log', {
              message: `✓ [parseJD] JD parsed — Required skills: ${skills}`,
            });
          } else if (nodeName === 'retrieveMatch') {
            retrievedCandidates = nodeOutput.retrievedCandidates ?? [];
            emit('log', {
              message:
                customCandidates.length > 0
                  ? `✓ [retrieveMatch] ${retrievedCandidates.length} candidates selected from the BYOD dataset`
                  : `✓ [retrieveMatch] ${retrievedCandidates.length} candidates retrieved via hybrid search`,
            });
          } else if (nodeName === 'simulateChat') {
            const evalCount = (nodeOutput.evaluations ?? []).length;
            emit('log', {
              message: `💬 [simulateChat] Interview simulation ${evalCount} complete`,
            });
          } else if (nodeName === 'rankCandidates') {
            // Find and emit newly completed evaluations
            const evaluations: CandidateEvaluation[] = nodeOutput.evaluations ?? [];
            for (const ev of evaluations) {
              if (!emittedIds.has(ev.candidate_id) && ev.interest_score > 0) {
                emittedIds.add(ev.candidate_id);

                const matchingCandidate = retrievedCandidates.find(
                  (c) => c.id === ev.candidate_id
                );

                emit('log', {
                  message: `⚡ [rankCandidates] ${matchingCandidate?.name ?? ev.candidate_id} — final score: ${ev.final_score}`,
                });

                if (matchingCandidate) {
                  const evaluated: EvaluatedCandidate = {
                    id: matchingCandidate.id,
                    name: matchingCandidate.name,
                    skills: matchingCandidate.skills as string[],
                    location: matchingCandidate.location,
                    salary_expectation: matchingCandidate.salary_expectation,
                    match_score: ev.match_score,
                    interest_score: ev.interest_score,
                    final_score: ev.final_score,
                    chat_transcript: ev.chat_transcript,
                  };
                  emit('candidate', evaluated);
                }
              }
            }
          }
        }

        emit('log', { message: '✅ Scout mission complete.' });
        emit('done', { message: 'Pipeline finished' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        emit('log', { message: `❌ Agent error: ${message}` });
        emit('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
    },
  });
}
