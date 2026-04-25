import { Client } from '@upstash/qstash';

if (!process.env.QSTASH_TOKEN) {
  throw new Error('QSTASH_TOKEN is required for background worker orchestration.');
}

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN,
});
