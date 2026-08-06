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

  if (session) {
    return (
      <div className="signin-card">
        <p className="auth-status">Signed in as {session.user.email}.</p>
        <div className="signin-sent-links">
          <a href={redirectTarget()}>Continue</a>
          <span aria-hidden="true">·</span>
          <button type="button" className="link-button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-card">
      <h1 className="signin-title">Sign in</h1>
      <p className="muted signin-subtitle">To comment, suggest edits, or propose new problems.</p>

      {status === "sent" ? (
        <div className="signin-sent">
          <p className="auth-status">
            Check your email for a sign-in link, sent to <strong>{email}</strong>.
          </p>
          <p className="muted signin-hint">
            Didn't get it after a minute or two? Check spam, or try again with a different email.
          </p>
          <button type="button" className="link-button" onClick={handleUseDifferentEmail}>
            Try a different email
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
