// Run by .github/workflows/notify-pr-opened.yml whenever a pull request is
// opened (both app-submitted and hand-authored). No npm dependencies —
// Node 22's built-in fetch is enough, so this workflow doesn't need `npm ci`.
export {}; // marks this file as a module, enabling top-level await below

const ADMIN_EMAIL = "pglutz@berkeley.edu";

const prTitle = process.env.PR_TITLE ?? "";
const prUrl = process.env.PR_URL ?? "";
const prNumber = process.env.PR_NUMBER ?? "";
const prAuthor = process.env.PR_AUTHOR ?? "someone";
const resendApiKey = process.env.RESEND_API_KEY;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "Open Problems in Mathematical Logic <noreply@mail.openlogicproblems.com>",
    to: ADMIN_EMAIL,
    subject: `New pull request #${prNumber}: ${prTitle}`,
    text: `${prAuthor} opened a pull request:\n\n${prTitle}\n\n${prUrl}`,
  }),
});

if (!res.ok) {
  console.error("Failed to send new-PR notification email:", await res.text());
  process.exit(1);
}

console.log(`Sent new-PR notification to ${ADMIN_EMAIL}`);
