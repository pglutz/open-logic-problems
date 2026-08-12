import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { useSigninHref } from "../../lib/signinHref";

export default function AuthWidget() {
  const [session, setSession] = useState<Session | null>(null);
  const signinHref = useSigninHref();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (session) {
    // Signing out itself now lives on the Account page, not here — this is
    // a genuine navigation link, unlike the old sign-out button.
    return (
      <a href="/account" className="nav-signin-button">
        Account
      </a>
    );
  }

  return (
    <a className="nav-signin-button" href={signinHref}>
      Sign In
    </a>
  );
}
