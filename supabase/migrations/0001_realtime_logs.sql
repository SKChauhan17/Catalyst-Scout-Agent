-- Create logs table for real-time terminal synchronization
create table logs (
    id uuid primary key default gen_random_uuid(),
    session_id text not null,
    message text not null,
    level text default 'info',
    node_name text,
    created_at timestamp with time zone default now()
);

-- Enable Realtime for the logs table
alter publication supabase_realtime add table logs;

-- Enforce RLS
alter table logs enable row level security;

-- Policies: Anonymous read/write access (scoped by session_id in practice)
create policy "Allow anonymous read access on logs" on logs for select to anon using (true);
create policy "Allow anonymous insert access on logs" on logs for insert to anon with check (true);
