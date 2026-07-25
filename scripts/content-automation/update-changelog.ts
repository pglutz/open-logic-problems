import { readProblems, readSnapshot, writeSnapshot, readChangelog, writeChangelog, todayIso } from "./lib.ts";

function main(): void {
  const problems = readProblems();
  const snapshot = readSnapshot();
  const changelog = readChangelog();
  let changed = false;

  for (const { frontmatter } of problems) {
    const { id, status, name } = frontmatter;
    const previousStatus = snapshot[id];
    if (previousStatus !== undefined && previousStatus !== status) {
      console.log(`Problem ${id} changed status: ${previousStatus} -> ${status}`);
      changelog.push({
        date: todayIso(),
        type: "status-change",
        id,
        name,
        old_status: previousStatus,
        new_status: status,
      });
      changed = true;
    }
    snapshot[id] = status;
  }

  writeSnapshot(snapshot);
  if (changed) writeChangelog(changelog);
}

try {
  main();
} catch (err) {
  console.error("update-changelog failed:", err);
  process.exit(1);
}
