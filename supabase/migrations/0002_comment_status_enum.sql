-- Run this against the existing dev database to move it from the boolean
-- `approved` column to the three-state `status` enum that 0001_comments.sql
-- now describes as the schema's starting point for any fresh install.

create type comment_status as enum ('pending', 'approved', 'rejected');

drop policy if exists "insert own unapproved comments" on comments;
drop policy if exists "read approved or own comments" on comments;

drop index if exists comments_problem_id_approved_idx;

alter table comments add column status comment_status not null default 'pending';
update comments set status = 'approved' where approved = true;
alter table comments drop column approved;

create index comments_problem_id_status_idx on comments (problem_id, status);

create policy "insert own pending comments" on comments
  for insert with check (author_id = auth.uid() and status = 'pending');

create policy "read approved or own comments" on comments
  for select using (status = 'approved' or author_id = auth.uid());
