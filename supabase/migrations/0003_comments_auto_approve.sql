-- Switches from pre-moderation to post-moderation: new comments are visible
-- immediately (status defaults to 'approved') instead of waiting for manual
-- review. Moderation still happens via the Table Editor, just after the
-- fact — flip a bad comment's status to 'rejected' to hide it.

alter table comments alter column status set default 'approved';

drop policy "insert own pending comments" on comments;

create policy "insert own approved comments" on comments
  for insert with check (author_id = auth.uid() and status = 'approved');
