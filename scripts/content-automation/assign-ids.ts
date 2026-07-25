import {
  readProblems,
  readPendingProblems,
  writeProblemFile,
  deletePendingFile,
  readSnapshot,
  writeSnapshot,
  readChangelog,
  writeChangelog,
  todayIso,
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

  for (const { file, frontmatter, body } of pending) {
    const id = nextId++;
    console.log(`Assigning id ${id} to problems/pending/${file}`);
    writeProblemFile(id, { ...frontmatter, id }, body);
    deletePendingFile(file);
    changelog.push({ date: todayIso(), type: "new-problem", id, name: frontmatter.name });
    snapshot[id] = frontmatter.status;
  }

  writeSnapshot(snapshot);
  writeChangelog(changelog);
}

try {
  main();
} catch (err) {
  console.error("assign-ids failed:", err);
  process.exit(1);
}
