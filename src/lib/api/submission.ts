import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Shared helpers for the submission API routes (suggest-an-edit and
// propose-a-new-problem) — both authenticate the same way, share one
// per-user rate-limit pool, and respond with the same JSON envelope.

export function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type AuthenticatedRequest =
  | { ok: true; user: User; userClient: SupabaseClient }
  | { ok: false; response: Response };

// Verifies the bearer token and returns a request-scoped Supabase client
// with that token forwarded as the Authorization header, so subsequent
// queries run *as that user* under RLS — no service-role key needed.
export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest> {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return { ok: false, response: jsonResponse(401, { error: "unauthenticated" }) };
  }

  const anonClient = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await anonClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return { ok: false, response: jsonResponse(401, { error: "unauthenticated" }) };
  }

  const userClient = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return { ok: true, user: data.user, userClient };
}

export const RATE_LIMIT_COUNT = 50;
export const RATE_LIMIT_WINDOW_HOURS = 24;

// Shared pool across edit-suggestions and new-problem proposals — counts
// all of this user's submissions regardless of kind, since the query only
// filters by author_id/created_at.
export async function checkSubmissionRateLimit(
  userClient: SupabaseClient,
  authorId: string,
): Promise<Response | null> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { count, error } = await userClient
    .from("problem_edit_submissions")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authorId)
    .gte("created_at", since);
  if (error) return jsonResponse(500, { error: "server_error" });
  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return jsonResponse(429, {
      error: "rate_limited",
      message: `You can submit up to ${RATE_LIMIT_COUNT} submissions per ${RATE_LIMIT_WINDOW_HOURS} hours.`,
    });
  }
  return null;
}
