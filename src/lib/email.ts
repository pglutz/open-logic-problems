// Transactional email for submission/merge notifications, sent directly via
// Resend's REST API (no SDK dependency needed — this is the only place the
// app sends arbitrary email; Supabase's own SMTP config handles auth emails
// separately). Reuses the same verified sending domain as that SMTP setup.

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Open Problems in Mathematical Logic <noreply@mail.openlogicproblems.com>";

// Best-effort — a failed send should never fail the submission it's
// attached to, since the PR has already been created by the time this runs.
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, text }),
    });
    if (!res.ok) {
      console.error("Failed to send email:", await res.text());
    }
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

export interface NotifyPayload {
  email: string;
  kind: "edit" | "new_problem";
  problemId: number | null;
  name: string;
}

// Embedded as a hidden HTML comment in the PR body at submission time, so
// the merge-notification workflow can read it straight off the closed PR's
// body (via the webhook event) with no database lookup — the PR body
// already names the submitter's email in plain text today, so this adds no
// new exposure, just makes the same data machine-readable.
export function buildNotifyMarker(payload: NotifyPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
  return `<!-- opl-notify:${encoded} -->`;
}
