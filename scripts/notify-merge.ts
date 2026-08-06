// Run by .github/workflows/notify-merge.yml when a submission PR is merged.
// No npm dependencies — Node 22's built-in fetch/Buffer/crypto are enough, so
// this workflow doesn't need an `npm ci` step at all.
import { createDecipheriv } from "node:crypto";

interface NotifyPayload {
  email: string;
  kind: "edit" | "new_problem";
  problemId: number | null;
  name: string;
}

const prBody = process.env.PR_BODY ?? "";
const prUrl = process.env.PR_URL ?? "";
const resendApiKey = process.env.RESEND_API_KEY;
const notifyMarkerKey = Buffer.from(process.env.NOTIFY_MARKER_KEY ?? "", "hex");

const match = prBody.match(/<!-- opl-notify:([A-Za-z0-9+/=]+) -->/);
if (!match) {
  console.log("No notification marker found in PR body; skipping (likely a hand-authored PR).");
  process.exit(0);
}

let payload: NotifyPayload;
try {
  // Layout matches buildNotifyMarker in src/lib/email.ts: iv (12) + authTag (16) + ciphertext.
  const raw = Buffer.from(match[1], "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", notifyMarkerKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  payload = JSON.parse(plaintext.toString("utf-8"));
} catch (err) {
  console.error("Failed to decrypt/parse notification marker:", err);
  process.exit(1);
}

if (!payload.email) {
  console.log("Notification marker has no email; skipping.");
  process.exit(0);
}

// A new-problem proposal isn't actually live the moment its PR merges — it
// still needs an id assigned by the content-automation workflow, which is
// what sends this notification for that case instead (see assign-ids.ts).
// This guard mainly matters for PRs opened before that change shipped,
// which still carry an embedded new_problem marker from the old flow.
if (payload.kind !== "edit") {
  console.log(`Marker kind is "${payload.kind}", not "edit"; skipping (handled elsewhere).`);
  process.exit(0);
}

const subject = `Your suggested edit to Problem #${payload.problemId} was accepted`;
const text = `Your suggested edit to Problem #${payload.problemId} (${payload.name}) has been accepted and is now live.\n\n${prUrl}`;

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
