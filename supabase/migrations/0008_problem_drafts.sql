-- Lets a signed-in user save an in-progress problem edit or new-problem
-- proposal and come back to it later without submitting it. Written
-- directly from the client (like comments/problem_edit_submissions), so RLS
-- is the only enforcement.
--
-- One draft per (author, problem) for edits; any number of new-problem
-- drafts. A single *plain* (non-partial) unique constraint on
-- (author_id, problem_id) gets both for free: for new-problem drafts
-- problem_id is always NULL, and Postgres never treats two NULLs as
-- conflicting under a unique constraint, so those rows never collide, while
-- edit drafts (a real problem_id) are capped at one per problem. This also
-- lets `.upsert(..., { onConflict: "author_id,problem_id" })` from the
-- client always land on the single edit-draft row without the app having to
-- track its id separately.

create table problem_drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  kind text not null check (kind in ('edit', 'new_problem')),
  problem_id integer,
  name text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint problem_drafts_problem_id_kind_check check (
    (kind = 'edit' and problem_id is not null) or
    (kind = 'new_problem' and problem_id is null)
  ),
  constraint problem_drafts_name_max_length check (char_length(name) <= 500),
  constraint problem_drafts_payload_max_length check (char_length(payload::text) <= 20000),
  unique (author_id, problem_id)
);

create index problem_drafts_author_id_kind_idx on problem_drafts (author_id, kind);

alter table problem_drafts enable row level security;

-- Every action (select/insert/update/delete) uses the same "it's mine"
-- condition here, unlike comments (where select is also open to everyone
-- for approved rows) -- so one policy for all commands is enough.
create policy "manage own drafts" on problem_drafts
  for all using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Caps stored drafts at 30 per author. Drafts are inserted directly from the
-- client (no server route to check this in application code first), same
-- reasoning as the comment rate-limit trigger.
create or replace function check_draft_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from problem_drafts where author_id = new.author_id) >= 30 then
    raise exception 'You have reached the limit of 30 saved drafts. Please delete an old draft before saving a new one.';
  end if;
  return new;
end;
$$;

create trigger problem_drafts_limit
  before insert on problem_drafts
  for each row
  execute function check_draft_limit();
