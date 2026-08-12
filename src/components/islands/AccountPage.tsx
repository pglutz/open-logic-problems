import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { useSigninHref } from "../../lib/signinHref";

interface Draft {
  id: string;
  kind: "edit" | "new_problem";
  problem_id: number | null;
  name: string;
  updated_at: string;
}

// Deep-links to the editor with `?resume=` — for edit drafts that's just
// `1` (at most one per problem, so there's nothing to disambiguate); for
// new-problem drafts it's the draft's own id, since a user can have several.
// See the matching `?resume=` handling in ProblemEditor.tsx.
function draftHref(draft: Draft): string {
  return draft.kind === "edit"
    ? `/problems/${draft.problem_id}/edit?resume=1`
    : `/problems/new?resume=${draft.id}`;
}

function draftLabel(draft: Draft): string {
  if (draft.kind === "edit") return draft.name || `Problem #${draft.problem_id}`;
  return draft.name.trim() || "(untitled proposal)";
}

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const signinHref = useSigninHref();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase
      .from("problem_drafts")
      .select("id, kind, problem_id, name, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        setDrafts(data as Draft[]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function discardDraft(id: string) {
    await supabase.from("problem_drafts").delete().eq("id", id);
    setDrafts((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

  if (!sessionLoaded) return null;

  if (!session) {
    return (
      <p className="comment-signin-prompt">
        <a href={signinHref}>Sign in</a> to view your account.
      </p>
    );
  }

  return (
    <div className="account-page">
      <div className="account-identity">
        <p>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <button type="button" className="editor-save-draft" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <section className="problem-section">
        <h2 className="section-heading">Saved Drafts</h2>
        {error && <p className="comment-error">{error}</p>}
        {drafts === null && !error && <p className="muted">Loading drafts…</p>}
        {drafts && drafts.length === 0 && <p className="muted">No saved drafts.</p>}
        {drafts && drafts.length > 0 && (
          <ul className="editor-draft-list">
            {drafts.map((d) => (
              <li key={d.id}>
                <span>
                  {draftLabel(d)}{" "}
                  <span className="muted">
                    ({d.kind === "edit" ? "suggested edit" : "new problem proposal"}, saved{" "}
                    {new Date(d.updated_at).toLocaleString()})
                  </span>
                </span>
                <span className="editor-draft-banner-actions">
                  <a href={draftHref(d)}>Open</a>
                  <button type="button" className="link-button" onClick={() => discardDraft(d.id)}>
                    Discard
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
