// Run by .github/workflows/notify-merge.yml when a submission PR is merged.
// No npm dependencies — Node 22's built-in fetch/Buffer are enough, so this
// workflow doesn't need an `npm ci` step at all.
export {}; // marks this file as a module, enabling top-level await below

interface NotifyPayload {
  email: string;
  kind: "edit" | "new_problem";
  problemId: number | null;
  name: string;
}

const prBody = process.env.PR_BODY ?? "";
const prUrl = process.env.PR_URL ?? "";
const resendApiKey = process.env.RESEND_API_KEY;

const match = prBody.match(/<!-- opl-notify:([A-Za-z0-9+/=]+) -->/);
if (!match) {
  console.log("No notification marker found in PR body; skipping (likely a hand-authored PR).");
  process.exit(0);
}

let payload: NotifyPayload;
try {
  payload = JSON.parse(Buffer.from(match[1], "base64").toString("utf-8"));
} catch (err) {
  console.error("Failed to parse notification marker:", err);
  process.exit(1);
}

if (!payload.email) {
  console.log("Notification marker has no email; skipping.");
  process.exit(0);
}

const subject =
  payload.kind === "edit"
    ? `Your suggested edit to Problem #${payload.problemId} was accepted`
    : `Your new problem proposal "${payload.name}" was accepted`;

const text =
  payload.kind === "edit"
    ? `Your suggested edit to Problem #${payload.problemId} (${payload.name}) has been accepted and is now live.\n\n${prUrl}`
    : `Your new problem proposal "${payload.name}" has been accepted and is now live.\n\n${prUrl}`;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "Open Problems in Mathematical Logic <noreply@mail.openlogicproblems.com>",
    to: payload.email,
    subject,
    text,
  }),
});

if (!res.ok) {
  console.error("Failed to send merge notification email:", await res.text());
  process.exit(1);
}

console.log(`Sent merge notification to ${payload.email}`);
