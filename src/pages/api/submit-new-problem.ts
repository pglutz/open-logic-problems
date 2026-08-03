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
  const newFileContent = serializePendingProblemFile(payload.frontmatter, payload.body);

  const notifyMarker = user.email
    ? buildNotifyMarker({
        email: user.email,
        kind: "new_problem",
        problemId: null,
        name: payload.frontmatter.name,
      })
    : "";

  let prResult;
  try {
    prResult = await submitNewProblemPR({
      slug,
      path: `problems/pending/${slug}.md`,
      newFileContent,
      commitMessage: payload.commitMessage,
      prTitle: `New problem proposal: ${payload.frontmatter.name}`,
      prBody: `Proposed by ${user.email ?? "a signed-in user"} via the website's new-problem form.\n\n${payload.commitMessage}${notifyMarker ? `\n\n${notifyMarker}` : ""}`,
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
      user.email,
      `Your new problem proposal "${payload.frontmatter.name}" was submitted`,
      `Your new problem proposal "${payload.frontmatter.name}" has been submitted as a pull request on github: ${prResult.prUrl}\n\nYou'll get another email when it's accepted.`,
    );
  }

  return jsonResponse(200, { prUrl: prResult.prUrl, prNumber: prResult.prNumber });
};
