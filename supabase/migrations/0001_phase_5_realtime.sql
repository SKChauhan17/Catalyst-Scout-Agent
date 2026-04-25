alter table evaluations
  add column if not exists final_score float,
  add column if not exists candidate_snapshot jsonb;

create index if not exists evaluations_job_id_created_at_idx
  on evaluations (job_id, created_at desc);

do $$
begin
  alter publication supabase_realtime add table evaluations;
exception
  when duplicate_object then null;
end $$;
