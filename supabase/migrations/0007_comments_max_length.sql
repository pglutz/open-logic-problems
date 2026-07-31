-- Caps comment length at 5000 characters. Comments are inserted directly
-- from the client (no server API route), so this has to be enforced in the
-- database rather than app code.

alter table comments
  add constraint comments_body_max_length check (char_length(body) <= 5000);
