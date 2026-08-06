// Transactional email for submission/merge notifications, sent directly via
// Resend's REST API (no SDK dependency needed — this is the only place the
// app sends arbitrary email; Supabase's own SMTP config handles auth emails
// separately). Reuses the same verified sending domain as that SMTP setup.

import { randomBytes, createCipheriv } from "node:crypto";

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

// Embedded as a hidden HTML comment in the PR body at submission time, so the
// merge-notification workflow can read it straight off the closed PR's body
// (via the webhook event) with no database lookup. The payload is AES-256-GCM
// encrypted (not just base64) since PR bodies are public — only the
// GitHub Action holding NOTIFY_MARKER_KEY can recover the submitter's email.
export function buildNotifyMarker(payload: NotifyPayload): string {
  const key = Buffer.from(import.meta.env.NOTIFY_MARKER_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encoded = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  return `<!-- opl-notify:${encoded} -->`;
}
