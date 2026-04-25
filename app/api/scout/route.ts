import { Client } from '@upstash/qstash';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { CustomCandidate } from '@/lib/agent/state';

export const runtime = 'nodejs';

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'catalyst-scout:scout',
});
const qstash = new Client({
  token: process.env.QSTASH_TOKEN ?? '',
});

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
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
          : crypto.randomUUID(),
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
  const ip = getClientIp(req);
  const { success, limit, remaining, reset } = await ratelimit.limit(`scout:${ip}`);

  if (!success) {
    return Response.json(
      { error: 'Rate limit exceeded. Please try again in a moment.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((reset - Date.now()) / 1000)).toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  const body = await req.json();
  const rawJD: string = body?.rawJD?.trim();
  const customCandidates = sanitizeCustomCandidates(body?.customCandidates);

  if (!rawJD) {
    return Response.json({ error: 'rawJD is required' }, { status: 400 });
  }

  if (!process.env.QSTASH_TOKEN) {
    return Response.json({ error: 'QSTASH_TOKEN is not configured' }, { status: 500 });
  }

  const jobId = crypto.randomUUID();
  const workerUrl =
    process.env.QSTASH_WORKER_URL ?? new URL('/api/worker', req.url).toString();

  await qstash.publishJSON({
    url: workerUrl,
    delay: 2,
    body: {
      jobId,
      rawJD,
      customCandidates,
    },
  });

  return Response.json(
    {
      ok: true,
      jobId,
      queued: true,
    },
    {
      status: 200,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    }
  );
}
