-- Enable vector extension
create extension if not exists vector;

-- Create jobs table
create table jobs (
    id uuid primary key default gen_random_uuid(),
    raw_text text not null,
    parsed_requirements jsonb,
    created_at timestamp with time zone default now()
);

-- Create candidates table
create table candidates (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    skills jsonb not null,
    location text,
    salary_expectation text,
    system_prompt_persona text not null,
    embedding vector(384),
    created_at timestamp with time zone default now()
);

-- Create evaluations table
create table evaluations (
    id uuid primary key default gen_random_uuid(),
    candidate_id uuid references candidates(id) on delete cascade,
    job_id uuid references jobs(id) on delete cascade,
    match_score float,
    interest_score float,
    chat_transcript jsonb,
    created_at timestamp with time zone default now()
);

-- Create match_candidates RPC for Hybrid Vector Search
create or replace function match_candidates(
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
returns table (
    id uuid,
    name text,
    skills jsonb,
    location text,
    salary_expectation text,
    system_prompt_persona text,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        c.id,
        c.name,
        c.skills,
        c.location,
        c.salary_expectation,
        c.system_prompt_persona,
        1 - (c.embedding <=> query_embedding) as similarity
    from candidates c
    where 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Enforce Row Level Security (RLS)
alter table jobs enable row level security;
alter table candidates enable row level security;
alter table evaluations enable row level security;

-- Policies: Anonymous read access
create policy "Allow anonymous read access on jobs" on jobs for select to anon using (true);
create policy "Allow anonymous read access on candidates" on candidates for select to anon using (true);
create policy "Allow anonymous read access on evaluations" on evaluations for select to anon using (true);

-- Policies: Service Role gets full access bypass implicitly, but explicitly defining for clarity
create policy "Allow service role full access on jobs" on jobs to service_role using (true) with check (true);
create policy "Allow service role full access on candidates" on candidates to service_role using (true) with check (true);
create policy "Allow service role full access on evaluations" on evaluations to service_role using (true) with check (true);
