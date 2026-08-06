// Transactional email for submission/merge notifications, sent directly via
// Resend's REST API (no SDK dependency needed — this is the only place the
// app sends arbitrary email; Supabase's own SMTP config handles auth emails
// separately). Reuses the same verified sending domain as that SMTP setup.
//
// Keys are passed in explicitly (not read from import.meta.env internally)
// so this module works both from Astro API routes (import.meta.env) and
// from the content-automation CI scripts, which run via plain Node
// (`node --experimental-strip-types`, no Vite involved, so import.meta.env
// isn't populated there) and read the same secrets from process.env instead.

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Open Problems in Mathematical Logic <noreply@mail.openlogicproblems.com>";

// Best-effort — a failed send should never fail the submission it's
// attached to, since the PR has already been created by the time this runs.
export async function sendEmail(apiKey: string, to: string, subject: string, text: string): Promise<void> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

// Embedded as a hidden HTML comment — in the PR body for edits (read by the
// merge-notification workflow straight off the closed PR's body, no lookup
// needed, since edits are live immediately on merge) and in the pending
// file's own body for new-problem proposals (read by the content-automation
// script once it actually assigns an id, since only then is the problem
// really live — see extractNotifyMarker). The payload is AES-256-GCM
// encrypted (not just base64) since both PR bodies and pending files are
// public — only whoever holds the marker key can recover the submitter's
// email.
export function buildNotifyMarker(markerKeyHex: string, payload: NotifyPayload): string {
  const key = Buffer.from(markerKeyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encoded = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  return `<!-- opl-notify:${encoded} -->`;
}

export function extractNotifyMarker(text: string): string | null {
  return text.match(/<!-- opl-notify:([A-Za-z0-9+/=]+) -->/)?.[1] ?? null;
}

export function decryptNotifyMarker(markerKeyHex: string, encoded: string): NotifyPayload {
  // Layout matches buildNotifyMarker: iv (12) + authTag (16) + ciphertext.
  const key = Buffer.from(markerKeyHex, "hex");
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8"));
}
