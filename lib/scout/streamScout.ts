import type { CustomCandidate } from '@/lib/agent/state';
import type { StructuredLLMError } from '@/lib/llm/router';

interface StreamScoutParams {
  rawJD: string;
  customCandidates: CustomCandidate[];
}

interface StreamScoutResponse {
  ok: boolean;
  jobId: string;
  queued: boolean;
}

type StreamScoutErrorPayload = {
  error?: string | StructuredLLMError;
};

export class ScoutRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ScoutRequestError';
    this.status = status;
  }
}

export async function streamScout({
  rawJD,
  customCandidates,
}: StreamScoutParams): Promise<StreamScoutResponse> {
  const response = await fetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawJD, customCandidates }),
  });

  const responseText = await response.text();
  let data: Partial<StreamScoutResponse> & StreamScoutErrorPayload = {};

  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText) as Partial<StreamScoutResponse> & StreamScoutErrorPayload;
    } catch {
      throw new ScoutRequestError(
        `API returned a non-JSON response (${response.status}).`,
        response.status
      );
    }
  }

  const errorMessage =
    typeof data.error === 'string'
      ? data.error
      : data.error?.message;

  if (!response.ok || !data.jobId) {
    throw new ScoutRequestError(
      errorMessage ?? `API error: ${response.status}`,
      response.status
    );
  }

  return data as StreamScoutResponse;
}
