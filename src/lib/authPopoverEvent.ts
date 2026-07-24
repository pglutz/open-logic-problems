// AuthWidget (in the nav) and CommentSection (on problem pages) are
// separate React islands that don't share context. This custom event lets
// CommentSection's "sign in" prompt open the nav's popover directly instead
// of just telling the user where to find it.
export const OPEN_AUTH_POPOVER_EVENT = "auth:open-popover";
