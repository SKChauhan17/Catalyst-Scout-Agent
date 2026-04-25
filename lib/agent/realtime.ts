import type { RealtimeChannel } from '@supabase/supabase-js';
import type { EvaluatedCandidate } from './state';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';

interface AgentLogPayload {
  jobId: string;
  message: string;
  timestamp: number;
}

interface AgentStatusPayload {
  jobId: string;
  state: 'running' | 'done' | 'error';
  message?: string;
  timestamp: number;
}

interface AgentResultPayload {
  jobId: string;
  candidate: EvaluatedCandidate;
  timestamp: number;
}

const channelRegistry = new Map<string, Promise<RealtimeChannel>>();

function createChannelPromise(jobId: string): Promise<RealtimeChannel> {
  const supabase = getAdminSupabaseClient();
  const channel = supabase.channel(`agent-logs:${jobId}`);

  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve(channel);
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        void supabase.removeChannel(channel);
        channelRegistry.delete(jobId);
        reject(new Error(`Failed to subscribe realtime channel for job ${jobId}.`));
      }
    });
  });
}

async function getChannel(jobId: string) {
  if (!jobId) {
    throw new Error('jobId is required for realtime log delivery.');
  }

  if (!channelRegistry.has(jobId)) {
    channelRegistry.set(jobId, createChannelPromise(jobId));
  }

  return channelRegistry.get(jobId)!;
}

export async function broadcastAgentLog(jobId: string, message: string, nodeName?: string) {
  const channel = await getChannel(jobId);
  const payload: AgentLogPayload = {
    jobId,
    message,
    timestamp: Date.now(),
  };

  // 1. Broadcast for sub-second UI updates
  await channel.send({
    type: 'broadcast',
    event: 'log',
    payload,
  });

  // 2. Persist to table for recovery/refresh resilience
  const supabase = getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('logs') as any).insert({
    session_id: jobId,
    message,
    node_name: nodeName,
  });
}

export async function broadcastAgentStatus(
  jobId: string,
  state: AgentStatusPayload['state'],
  message?: string
) {
  const channel = await getChannel(jobId);
  const payload: AgentStatusPayload = {
    jobId,
    state,
    message,
    timestamp: Date.now(),
  };

  await channel.send({
    type: 'broadcast',
    event: 'status',
    payload,
  });
}

export async function broadcastAgentResult(jobId: string, candidate: EvaluatedCandidate) {
  const channel = await getChannel(jobId);
  const payload: AgentResultPayload = {
    jobId,
    candidate,
    timestamp: Date.now(),
  };

  await channel.send({
    type: 'broadcast',
    event: 'result',
    payload,
  });
}

export async function closeAgentRealtime(jobId: string) {
  const pendingChannel = channelRegistry.get(jobId);
  if (!pendingChannel) {
    return;
  }

  channelRegistry.delete(jobId);

  try {
    const channel = await pendingChannel;
    await getAdminSupabaseClient().removeChannel(channel);
  } catch {
    // Ignore teardown failures for short-lived worker executions.
  }
}
