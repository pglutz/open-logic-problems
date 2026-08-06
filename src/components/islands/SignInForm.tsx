import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

// Only a same-origin path is accepted, so this can't be used as an open
// redirect via a crafted /signin?redirect= link.
function redirectTarget(): string {
  const raw = new URLSearchParams(window.location.search).get("redirect");
  return raw && raw.startsWith("/") ? raw : "/";
}

export default function SignInForm() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Covers both the tab that completed the magic link (lands here already
  // signed in) and this tab, if it's still open and picks up the same
  // session via Supabase's cross-tab sync — either way, there's nothing to
  // do on /signin once signed in, so leave immediately rather than showing
  // an intermediate "you're signed in" screen.
  useEffect(() => {
    if (session) window.location.href = redirectTarget();
  }, [session]);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirectTarget()}` },
    });
    setErrorMessage(error?.message ?? null);
    setStatus(error ? "error" : "sent");
  }

  function handleUseDifferentEmail() {
    setEmail("");
    setStatus("idle");
    setErrorMessage(null);
  }

  // Signed-in is a transient state here — the effect above navigates away
  // immediately, so there's nothing worth rendering for it.
  if (session) return null;

  return (
    <div className="signin-card">
      <h1 className="signin-title">Sign in</h1>
      <p className="muted signin-subtitle">To comment, suggest edits, or propose new problems.</p>

      {status === "sent" ? (
        <div className="signin-sent">
          <p className="auth-status">
            Check your email for a sign-in link, sent to <strong>{email}</strong>.
          </p>
          <button type="button" className="link-button" onClick={handleUseDifferentEmail}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="editor-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="editor-submit signin-submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          <p className="muted signin-hint">
            Didn't get it after a minute or two? Check spam, or try again with a different email.
          </p>
          {status === "error" && (
            <p className="comment-error" role="alert">
              {errorMessage ?? "Something went wrong. Please try again."}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
