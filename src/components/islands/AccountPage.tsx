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

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="15 3 21 3 21 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

  // Signs out and sends the user straight to sign-in (rather than just
  // signing out and leaving them on this now-signed-out page) — for signing
  // into a second account (e.g. a different GitHub/Google login) without an
  // extra click to find the sign-in link again. Reuses signinHref so it
  // still redirects back to /account afterward, same as clicking "Sign in"
  // normally would.
  async function switchAccounts() {
    await supabase.auth.signOut();
    window.location.href = signinHref;
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
        <span className="account-identity-actions">
          <button type="button" className="account-action-button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <button type="button" className="account-action-button" onClick={switchAccounts}>
            Switch accounts
          </button>
        </span>
      </div>

      <section>
        <h2>Saved Drafts</h2>
        {error && <p className="comment-error">{error}</p>}
        {drafts === null && !error && <p className="muted">Loading drafts…</p>}
        {drafts && drafts.length === 0 && <p className="muted">No saved drafts.</p>}
        {drafts && drafts.length > 0 && (
          <ul className="draft-list draft-panel">
            {drafts.map((d) => (
              <li key={d.id} className="draft-item">
                <span className="draft-title-col">{draftLabel(d)}</span>
                <span className="draft-type-col muted">
                  {d.kind === "edit" ? "Suggested edit" : "New problem proposal"}
                </span>
                <span className="draft-time-col muted">{new Date(d.updated_at).toLocaleString()}</span>
                <span className="draft-actions-col">
                  <a href={draftHref(d)} className="draft-action-icon draft-action-open" aria-label="Open draft" title="Open">
                    <OpenIcon />
                  </a>
                  <button
                    type="button"
                    className="draft-action-icon draft-action-discard"
                    aria-label="Discard draft"
                    title="Discard"
                    onClick={() => discardDraft(d.id)}
                  >
                    <TrashIcon />
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
