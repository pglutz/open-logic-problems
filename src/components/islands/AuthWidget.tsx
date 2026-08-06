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
    // Deliberately an <a>, not a <button> — see the sizing comment on
    // .nav-signin-button in Nav.astro. role="button" tells assistive tech
    // this behaves as an action, not a navigation, despite the tag.
    return (
      <a
        href="#"
        role="button"
        className="nav-signin-button"
        onClick={(e) => {
          e.preventDefault();
          supabase.auth.signOut();
        }}
      >
        Sign Out
      </a>
    );
  }

  return (
    <a className="nav-signin-button" href="/signin">
      Sign In
    </a>
  );
}
