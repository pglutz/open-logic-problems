import {
  readProblems,
  readPendingProblems,
  writeProblemFile,
  deletePendingFile,
  readSnapshot,
  writeSnapshot,
  readChangelog,
  writeChangelog,
  writePendingNotifications,
  todayIso,
  type PendingNotification,
} from "./lib.ts";

function main(): void {
  const pending = readPendingProblems();
  if (pending.length === 0) {
    console.log("No pending problems to assign ids to.");
    return;
  }

  let nextId = Math.max(0, ...readProblems().map((p) => p.frontmatter.id)) + 1;
  const snapshot = readSnapshot();
  const changelog = readChangelog();
  const notifications: PendingNotification[] = [];

  for (const { file, frontmatter, body, notifyMarker } of pending) {
    const id = nextId++;
    console.log(`Assigning id ${id} to problems/pending/${file}`);
    writeProblemFile(id, { ...frontmatter, id }, body);
    deletePendingFile(file);
    changelog.push({ date: todayIso(), type: "new-problem", id, name: frontmatter.name });
    snapshot[id] = frontmatter.status;
    if (notifyMarker) notifications.push({ id, marker: notifyMarker });
  }

  writeSnapshot(snapshot);
  writeChangelog(changelog);
  // Not actually sent from here — see notify-assigned.ts, run as a later
  // workflow step, only after this assignment has been committed and pushed.
  writePendingNotifications(notifications);
}

try {
  main();
} catch (err) {
  console.error("assign-ids failed:", err);
  process.exit(1);
}
