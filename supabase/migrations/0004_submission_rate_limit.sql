create table problem_edit_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  problem_id integer not null,
  pr_url text not null,
  created_at timestamptz not null default now()
);

create index problem_edit_submissions_author_id_created_at_idx
  on problem_edit_submissions (author_id, created_at);

alter table problem_edit_submissions enable row level security;

create policy "insert own submissions" on problem_edit_submissions
  for insert with check (author_id = auth.uid());

create policy "read own submissions" on problem_edit_submissions
  for select using (author_id = auth.uid());
