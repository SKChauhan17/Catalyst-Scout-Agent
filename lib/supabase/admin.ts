import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getAdminSupabaseClient() {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for worker-side Supabase access.'
      );
    }

    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
