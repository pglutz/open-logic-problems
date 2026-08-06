export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { pendingProblemSchema } from "../../lib/problemSchema";
import { serializePendingProblemFile } from "../../lib/markdown/frontmatter";
import { submitNewProblemPR } from "../../lib/github";
import {
  jsonResponse,
  authenticateRequest,
  checkSubmissionRateLimit,
  logSubmission,
} from "../../lib/api/submission";
import { sendEmail, buildNotifyMarker } from "../../lib/email";

const requestSchema = z.object({
  frontmatter: pendingProblemSchema,
  body: z.string().min(1).max(50000),
  commitMessage: z.string().min(1).max(500),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "problem"
  );
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { user, userClient } = auth;

  let payload;
  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse(400, { error: "invalid_request", message: "Malformed submission." });
  }

  const rateLimited = await checkSubmissionRateLimit(userClient, user.id);
  if (rateLimited) return rateLimited;

  const slug = `${slugify(payload.frontmatter.name)}-${crypto.randomUUID().slice(0, 8)}`;

  // Embedded in the pending file's own body, not the PR body — unlike an
  // edit (live the moment its PR merges), a new problem isn't actually live
  // until the content-automation workflow assigns it an id, so that's what
  // reads this marker and sends the "accepted" email, not the merge-time
  // workflow. See assign-ids.ts.
  const notifyMarker = user.email
    ? buildNotifyMarker(import.meta.env.NOTIFY_MARKER_KEY, {
        email: user.email,
        kind: "new_problem",
        problemId: null,
        name: payload.frontmatter.name,
      })
    : "";
  const bodyWithMarker = notifyMarker ? `${payload.body}\n\n${notifyMarker}` : payload.body;
  const newFileContent = serializePendingProblemFile(payload.frontmatter, bodyWithMarker);

  let prResult;
  try {
    prResult = await submitNewProblemPR({
      slug,
      path: `problems/pending/${slug}.md`,
      newFileContent,
      commitMessage: payload.commitMessage,
      prTitle: `New problem proposal: ${payload.frontmatter.name}`,
      prBody: `Proposed via the website's new-problem form.\n\n${payload.commitMessage}`,
    });
  } catch {
    return jsonResponse(502, { error: "github_error", message: "Failed to open a pull request. Please try again." });
  }

  await logSubmission(userClient, {
    author_id: user.id,
    problem_id: null,
    kind: "new_problem",
    pr_url: prResult.prUrl,
  });

  if (user.email) {
    await sendEmail(
      import.meta.env.RESEND_API_KEY,
      user.email,
      `Your new problem proposal "${payload.frontmatter.name}" was submitted`,
      `Your new problem proposal "${payload.frontmatter.name}" has been submitted as a pull request on github: ${prResult.prUrl}\n\nYou'll get another email when it's accepted.`,
    );
  }

  return jsonResponse(200, { prUrl: prResult.prUrl, prNumber: prResult.prNumber });
};
