import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { renderCommentMarkdown } from "../../lib/markdown/pipeline";
import { OPEN_AUTH_POPOVER_EVENT } from "../../lib/authPopoverEvent";

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  bodyHtml: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

const NAME_STORAGE_KEY = "comment-author-name";

export default function CommentSection({ problemId }: { problemId: number }) {
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_STORAGE_KEY) ?? "");
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("comments")
      .select("id, author_id, author_name, body, status, created_at")
      .eq("problem_id", problemId)
      .order("created_at", { ascending: true })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        const withHtml = await Promise.all(
          data.map(async (comment) => ({
            ...comment,
            bodyHtml: await renderCommentMarkdown(comment.body),
          })),
        );
        if (!cancelled) setComments(withHtml as Comment[]);
      });
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    window.localStorage.setItem(NAME_STORAGE_KEY, name);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        problem_id: problemId,
        author_id: session.user.id,
        author_name: name,
        body,
      })
      .select("id, author_id, author_name, body, status, created_at")
      .single();
    if (error) {
      setSubmitting(false);
      setError(error.message);
      return;
    }
    const bodyHtml = await renderCommentMarkdown(data.body);
    setSubmitting(false);
    setComments((prev) => [...(prev ?? []), { ...data, bodyHtml } as Comment]);
    setBody("");
  }

  return (
    <div className="comment-section">
      {comments === null && <p className="muted">Loading comments…</p>}
      {comments && comments.length === 0 && <p className="muted">No comments yet.</p>}
      {comments && comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((comment, index) => (
            <li key={comment.id} className="comment">
              <div className="comment-meta">
                <span className="comment-number">#{index + 1}</span>
                <span className="comment-author">{comment.author_name}</span>
                <span className="comment-date">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
                {comment.status === "pending" && (
                  <span className="badge comment-pending-badge">Pending review</span>
                )}
                {comment.status === "rejected" && (
                  <span className="badge comment-rejected-badge">
                    Rejected (only visible to you)
                  </span>
                )}
              </div>
              <div className="comment-body" dangerouslySetInnerHTML={{ __html: comment.bodyHtml }} />
            </li>
          ))}
        </ul>
      )}

      {session ? (
        <form className="comment-form comment-form-boxed" onSubmit={handleSubmit}>
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            required
            placeholder="Add a comment… (Markdown links and $LaTeX$ are supported)"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
          {error && <p className="comment-error">{error}</p>}
        </form>
      ) : (
        <p className="comment-signin-prompt">
          <button
            type="button"
            className="link-button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AUTH_POPOVER_EVENT))}
          >
            Sign in
          </button>{" "}
          to leave a comment.
        </p>
      )}
    </div>
  );
}
