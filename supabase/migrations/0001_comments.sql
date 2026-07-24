create type comment_status as enum ('pending', 'approved', 'rejected');

create table comments (
  id uuid primary key default gen_random_uuid(),
  problem_id integer not null,          -- matches a problem's frontmatter id; no FK (problems live in files, not the DB)
  author_id uuid not null references auth.users(id),
  author_name text not null,
  body text not null,
  status comment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index comments_problem_id_status_idx on comments (problem_id, status);
alter table comments enable row level security;

create policy "insert own pending comments" on comments
  for insert with check (author_id = auth.uid() and status = 'pending');

create policy "read approved or own comments" on comments
  for select using (status = 'approved' or author_id = auth.uid());
