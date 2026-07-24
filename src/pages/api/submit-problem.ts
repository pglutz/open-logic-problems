export const prerender = false;

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { problemFrontmatterSchema } from "../../lib/problemSchema";
import { serializeProblemFile } from "../../lib/markdown/frontmatter";
import { submitProblemEditPR } from "../../lib/github";

const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_HOURS = 24;

const requestSchema = z.object({
  problemId: z.number().int().positive(),
  frontmatter: problemFrontmatterSchema,
  body: z.string().min(1),
  commitMessage: z.string().min(1).max(500),
});

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json(401, { error: "unauthenticated" });

  const anonClient = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: userData, error: userError } = await anonClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json(401, { error: "unauthenticated" });

  let payload;
  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return json(400, { error: "invalid_request", message: "Malformed submission." });
  }
  if (payload.frontmatter.id !== payload.problemId) {
    return json(400, { error: "invalid_request", message: "Problem id mismatch." });
  }

  const userClient = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { count, error: countError } = await userClient
    .from("problem_edit_submissions")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userData.user.id)
    .gte("created_at", since);
  if (countError) return json(500, { error: "server_error" });
  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return json(429, {
      error: "rate_limited",
      message: `You can submit up to ${RATE_LIMIT_COUNT} edits per ${RATE_LIMIT_WINDOW_HOURS} hours.`,
    });
  }

  const newFileContent = serializeProblemFile(payload.frontmatter, payload.body);

  let prResult;
  try {
    prResult = await submitProblemEditPR({
      problemId: payload.problemId,
      path: `problems/${payload.problemId}.md`,
      newFileContent,
      commitMessage: payload.commitMessage,
      prTitle: `Suggest edit: Problem #${payload.problemId} — ${payload.commitMessage}`,
      prBody: `Suggested by ${userData.user.email ?? "a signed-in user"} via the website's edit form.\n\n${payload.commitMessage}`,
    });
  } catch {
    return json(502, { error: "github_error", message: "Failed to open a pull request. Please try again." });
  }

  await userClient.from("problem_edit_submissions").insert({
    author_id: userData.user.id,
    problem_id: payload.problemId,
    pr_url: prResult.prUrl,
  });

  return json(200, { prUrl: prResult.prUrl, prNumber: prResult.prNumber });
};
