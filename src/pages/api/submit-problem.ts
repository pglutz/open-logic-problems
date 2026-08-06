export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { problemFrontmatterSchema } from "../../lib/problemSchema";
import { serializeProblemFile } from "../../lib/markdown/frontmatter";
import { submitProblemEditPR } from "../../lib/github";
import {
  jsonResponse,
  authenticateRequest,
  checkSubmissionRateLimit,
  logSubmission,
} from "../../lib/api/submission";
import { sendEmail, buildNotifyMarker } from "../../lib/email";

const requestSchema = z.object({
  problemId: z.number().int().positive(),
  frontmatter: problemFrontmatterSchema,
  body: z.string().min(1).max(50000),
  commitMessage: z.string().min(1).max(500),
});

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
  if (payload.frontmatter.id !== payload.problemId) {
    return jsonResponse(400, { error: "invalid_request", message: "Problem id mismatch." });
  }

  const rateLimited = await checkSubmissionRateLimit(userClient, user.id);
  if (rateLimited) return rateLimited;

  const newFileContent = serializeProblemFile(payload.frontmatter, payload.body);

  const notifyMarker = user.email
    ? buildNotifyMarker({
        email: user.email,
        kind: "edit",
        problemId: payload.problemId,
        name: payload.frontmatter.name,
      })
    : "";

  let prResult;
  try {
    prResult = await submitProblemEditPR({
      problemId: payload.problemId,
      path: `problems/${payload.problemId}.md`,
      newFileContent,
      commitMessage: payload.commitMessage,
      prTitle: `Suggested edit: Problem #${payload.problemId} — ${payload.commitMessage}`,
      prBody: `Suggested via the website's edit form.\n\n${payload.commitMessage}${notifyMarker ? `\n\n${notifyMarker}` : ""}`,
    });
  } catch {
    return jsonResponse(502, { error: "github_error", message: "Failed to open a pull request. Please try again." });
  }

  await logSubmission(userClient, {
    author_id: user.id,
    problem_id: payload.problemId,
    kind: "edit",
    pr_url: prResult.prUrl,
  });

  if (user.email) {
    // Awaited rather than fire-and-forget: a serverless function's process
    // can be frozen the instant the response is sent, so an un-awaited send
    // isn't guaranteed to complete.
    await sendEmail(
      user.email,
      `Your suggested edit to Problem #${payload.problemId} was submitted`,
      `Your suggested edit to Problem #${payload.problemId} has been submitted as a pull request on github: ${prResult.prUrl}\n\nYou'll get another email when it's accepted.`,
    );
  }

  return jsonResponse(200, { prUrl: prResult.prUrl, prNumber: prResult.prNumber });
};
