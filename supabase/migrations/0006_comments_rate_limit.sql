-- Rate-limits comment posting to 100 per author per rolling 24h window.
-- Comments are inserted directly from the client (no server API route, per
-- the Milestone 3 architecture decision), so this can't be enforced in
-- application code the way problem_edit_submissions is -- it has to live in
-- the database itself. A BEFORE INSERT trigger (rather than folding the
-- count into the RLS policy's WITH CHECK) is used so a rate-limited insert
-- gets a clear, application-facing error message back through supabase-js
-- instead of a generic "violates row-level security policy" message.

create or replace function check_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from comments
    where author_id = new.author_id
      and created_at > now() - interval '24 hours'
  ) >= 100 then
    raise exception 'You have reached the limit of 100 comments per 24 hours. Please try again later.';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on comments
  for each row
  execute function check_comment_rate_limit();
