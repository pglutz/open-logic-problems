import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

export default function AuthWidget() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? "error" : "sent");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setStatus("idle");
    setEmail("");
  }

  if (session) {
    return (
      <div className="auth-widget">
        <span className="auth-status">Signed in as {session.user.email}</span>
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  if (status === "sent") {
    return <span className="auth-status">Check your email for a sign-in link.</span>;
  }

  return (
    <form className="auth-widget" onSubmit={handleSignIn}>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Sign in"}
      </button>
      {status === "error" && <span className="auth-status auth-error">Something went wrong.</span>}
    </form>
  );
}
