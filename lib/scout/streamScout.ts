import type { EvaluatedCandidate } from '@/components/CandidateCard';
import type { CustomCandidate } from '@/lib/agent/state';

interface StreamScoutParams {
  rawJD: string;
  customCandidates: CustomCandidate[];
  signal: AbortSignal;
  onLog: (message: string) => void;
  onCandidate: (candidate: EvaluatedCandidate) => void;
  onDone?: () => void;
}

export async function streamScout({
  rawJD,
  customCandidates,
  signal,
  onLog,
  onCandidate,
  onDone,
}: StreamScoutParams): Promise<void> {
  const response = await fetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawJD, customCandidates }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        }

        if (line.startsWith('data: ')) {
          dataStr = line.slice(6).trim();
        }
      }

      if (!dataStr) {
        continue;
      }

      const data = JSON.parse(dataStr) as { message?: string };

      if (eventType === 'log' && data.message) {
        onLog(data.message);
      }

      if (eventType === 'candidate') {
        onCandidate(data as EvaluatedCandidate);
      }

      if (eventType === 'done' || eventType === 'error') {
        if (eventType === 'error' && data.message) {
          onLog(`❌ ${data.message}`);
        }
        onDone?.();
      }
    }
  }
}
