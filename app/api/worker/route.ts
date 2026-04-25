import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { catalystScoutGraph } from '@/lib/agent/graph';
import {
  broadcastAgentLog,
  broadcastAgentStatus,
  closeAgentRealtime,
} from '@/lib/agent/realtime';
import { normalizeStructuredError } from '@/lib/llm/router';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AgentState, CustomCandidate } from '@/lib/agent/state';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface WorkerPayload {
  jobId: string;
  rawJD: string;
  customCandidates?: CustomCandidate[];
}

function isValidPayload(payload: WorkerPayload): payload is WorkerPayload {
  return Boolean(payload.jobId?.trim() && payload.rawJD?.trim());
}

async function workerHandler(request: Request): Promise<Response> {
  let jobId = '';

  try {
    const payload = await request.json() as WorkerPayload;

    if (!isValidPayload(payload)) {
      return Response.json({ error: 'Invalid worker payload' }, { status: 400 });
    }

    jobId = payload.jobId;
    const customCandidates = Array.isArray(payload.customCandidates)
      ? payload.customCandidates
      : [];

    const supabase = getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: jobError } = await (supabase.from('jobs') as any).upsert({
      id: jobId,
      raw_text: payload.rawJD,
    });

    if (jobError) {
      throw new Error(`[worker] Failed to create job record: ${jobError.message}`);
    }

    await broadcastAgentStatus(jobId, 'running');
    await broadcastAgentLog(jobId, '🚀 Initializing Catalyst Scout Agent...');

    if (customCandidates.length > 0) {
      await broadcastAgentLog(
        jobId,
        `📦 BYOD mode active — ${customCandidates.length} custom candidates loaded into memory.`
      );
    }

    const initialState: Partial<AgentState> = {
      jobId,
      rawJD: payload.rawJD,
      parsedJD: null,
      customCandidates,
      retrievedCandidates: [],
      evaluations: [],
      currentCandidateIndex: 0,
    };

    await catalystScoutGraph.invoke(initialState);

    await broadcastAgentLog(jobId, '✅ Scout mission complete.');
    await broadcastAgentStatus(jobId, 'done');

    return Response.json({ ok: true, jobId });
  } catch (error) {
    const structuredError = normalizeStructuredError(error);
    const message = structuredError.message;

    if (jobId) {
      await broadcastAgentLog(jobId, `❌ Agent error: ${message}`);
      await broadcastAgentStatus(jobId, 'error', message);
    }

    return Response.json({ ok: false, error: structuredError }, { status: 500 });
  } finally {
    if (jobId) {
      await closeAgentRealtime(jobId);
    }
  }
}

export const POST = verifySignatureAppRouter(workerHandler);
