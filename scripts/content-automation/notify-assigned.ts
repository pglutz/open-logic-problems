// Run by content-automation.yml as the step immediately after "Commit and
// push if changed" — deliberately after, not as part of assign-ids.ts,
// so that a submitter only gets the "accepted" email once id assignment
// has genuinely been committed and pushed, not merely computed locally on
// the runner. See lib.ts's writePendingNotifications for why.
import { readPendingNotifications } from "./lib.ts";
import { sendEmail, decryptNotifyMarker } from "../../src/lib/email.ts";

const SITE_URL = "https://www.openlogicproblems.com";

async function main(): Promise<void> {
  const notifications = readPendingNotifications();
  if (notifications.length === 0) {
    console.log("No acceptance notifications to send.");
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const notifyMarkerKey = process.env.NOTIFY_MARKER_KEY;
  if (!resendApiKey || !notifyMarkerKey) {
    console.error("RESEND_API_KEY or NOTIFY_MARKER_KEY not set; skipping all acceptance emails.");
    return;
  }

  for (const { id, marker } of notifications) {
    try {
      const payload = decryptNotifyMarker(notifyMarkerKey, marker);
      await sendEmail(
        resendApiKey,
        payload.email,
        `Your new problem proposal "${payload.name}" was accepted`,
        `Your new problem proposal "${payload.name}" has been accepted and is now live.\n\n${SITE_URL}/problems/${id}`,
      );
      console.log(`Sent acceptance notification for problem #${id} to ${payload.email}`);
    } catch (err) {
      console.error(`Failed to notify for problem #${id}:`, err);
    }
  }
}

try {
  await main();
} catch (err) {
  console.error("notify-assigned failed:", err);
  process.exit(1);
}
