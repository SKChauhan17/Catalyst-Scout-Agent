import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function appendLog(sessionId: string, message: string, level = 'info', nodeName?: string) {
  const { error } = await supabase.from('logs').insert({
    session_id: sessionId,
    message,
    level,
    node_name: nodeName,
  });

  if (error) {
    console.error(`[appendLog] Supabase error: ${error.message}`);
  }
}
