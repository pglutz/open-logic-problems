import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

export default function AuthWidget() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (session) {
    return (
      <button type="button" className="nav-signin-button" onClick={() => supabase.auth.signOut()}>
        Sign Out
      </button>
    );
  }

  return (
    <a className="nav-signin-button" href="/signin">
      Sign In
    </a>
  );
}
