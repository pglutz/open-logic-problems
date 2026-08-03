import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { OPEN_AUTH_POPOVER_EVENT } from "../../lib/authPopoverEvent";

export default function AuthWidget() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    function handleOpenRequest() {
      setOpen(true);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.addEventListener(OPEN_AUTH_POPOVER_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_AUTH_POPOVER_EVENT, handleOpenRequest);
  }, []);

  async function handleSignIn(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setErrorMessage(error?.message ?? null);
    setStatus(error ? "error" : "sent");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setStatus("idle");
    setEmail("");
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="auth-widget" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-link auth-icon-button"
        aria-label={session ? `Account: ${session.user.email}` : "Sign in"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
          <path
            d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        {session && <span className="auth-signed-in-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="auth-popover">
          {session ? (
            <>
              <p className="auth-status">Signed in as {session.user.email}</p>
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : status === "sent" ? (
            <span className="auth-status" role="status">
              Check your email for a sign-in link.
            </span>
          ) : (
            <form onSubmit={handleSignIn}>
              <label htmlFor="auth-email" className="visually-hidden">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Sign in"}
              </button>
              {status === "error" && (
                <span className="auth-status auth-error" role="alert">
                  {errorMessage ?? "Something went wrong."}
                </span>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
