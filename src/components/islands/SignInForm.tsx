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
  const [oauthError, setOauthError] = useState<string | null>(null);

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

  async function handleOAuthSignIn(provider: "github" | "google") {
    setOauthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectTarget()}` },
    });
    if (error) setOauthError(error.message);
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

      <div className="signin-oauth-group">
        <button type="button" className="signin-oauth-button" onClick={() => handleOAuthSignIn("github")}>
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </button>
        <button type="button" className="signin-oauth-button" onClick={() => handleOAuthSignIn("google")}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.68 9c0-.593.102-1.17.284-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>
      </div>
      {oauthError && (
        <p className="comment-error" role="alert">
          {oauthError}
        </p>
      )}

      <div className="signin-divider">
        <span className="signin-divider-line" />
        <span>or continue with email</span>
        <span className="signin-divider-line" />
      </div>

      {status === "sent" ? (
        <div className="signin-sent">
          <p className="auth-status">
            Check your email for a sign-in link, sent to <strong>{email}</strong>.
          </p>
          <p className="signin-hint">
            Some users have reported not receiving the sign-in link, especially when using work or
            school email addresses. If you do not receive the link within a minute or two, try a
            different email or sign in with GitHub instead.
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
          <p className="signin-hint">
            Some users have reported not receiving the sign-in link, especially when using work or
            school email addresses. If you do not receive the link within a minute or two, try a
            different email or sign in with GitHub instead.
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
