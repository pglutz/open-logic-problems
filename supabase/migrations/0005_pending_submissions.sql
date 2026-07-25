-- Extend problem_edit_submissions to also log new-problem proposals, sharing
-- the same per-user rate-limit pool as edits (the count query in
-- submit-problem.ts / submit-new-problem.ts already filters by author_id
-- only, not problem_id, so no query changes are needed — just relaxing the
-- schema). The table name stays as-is despite now covering both kinds —
-- renaming it would also want the index and both RLS policies renamed for
-- consistency, for a purely cosmetic win; the new `kind` column already
-- self-documents the dual purpose in Supabase Studio's table editor.

alter table problem_edit_submissions
  add column kind text not null default 'edit' check (kind in ('edit', 'new_problem'));

alter table problem_edit_submissions
  alter column problem_id drop not null;

alter table problem_edit_submissions
  add constraint problem_edit_submissions_problem_id_kind_check
  check (
    (kind = 'edit' and problem_id is not null) or
    (kind = 'new_problem' and problem_id is null)
  );
