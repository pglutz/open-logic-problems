import { useEffect, useState } from "react";

// Builds a /signin link carrying the current page as a redirect target, so
// the post-magic-link landing page matches wherever "Sign in" was clicked
// from. Starts as a plain "/signin" — matching what the server renders,
// since window isn't available there — and upgrades to include the redirect
// param in an effect, after mount, so hydration never sees a mismatch.
export function useSigninHref(): string {
  const [href, setHref] = useState("/signin");
  useEffect(() => {
    setHref(`/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, []);
  return href;
}
