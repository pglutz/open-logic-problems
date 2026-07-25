import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter, serializeProblemFile } from "../../src/lib/markdown/frontmatter.ts";
import {
  problemFrontmatterSchema,
  pendingProblemSchema,
  type ProblemFrontmatter,
  type PendingProblemFrontmatter,
} from "../../src/lib/problemSchema.ts";
import type { ProblemStatus } from "../../src/lib/problems.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "../..");
const problemsDir = path.join(repoRoot, "problems");
const pendingDir = path.join(problemsDir, "pending");
const snapshotPath = path.join(repoRoot, "data", "status-snapshot.json");
const changelogPath = path.join(repoRoot, "data", "changelog.json");

export { serializeProblemFile };

export interface ProblemFile {
  file: string;
  frontmatter: ProblemFrontmatter;
  body: string;
}

export interface PendingProblemFile {
  file: string;
  frontmatter: PendingProblemFrontmatter;
  body: string;
}

// Mirrors content.config.ts's own glob pattern ("*.md", non-recursive) so
// this never picks up problems/pending/*.md.
function readMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export function readProblems(): ProblemFile[] {
  return readMarkdownFiles(problemsDir).map((file) => {
    const raw = fs.readFileSync(path.join(problemsDir, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    return { file, frontmatter: problemFrontmatterSchema.parse(data), body };
  });
}

export function readPendingProblems(): PendingProblemFile[] {
  return readMarkdownFiles(pendingDir).map((file) => {
    const raw = fs.readFileSync(path.join(pendingDir, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    return { file, frontmatter: pendingProblemSchema.parse(data), body };
  });
}

export function writeProblemFile(id: number, frontmatter: ProblemFrontmatter, body: string): void {
  fs.writeFileSync(path.join(problemsDir, `${id}.md`), serializeProblemFile(frontmatter, body));
}

export function deletePendingFile(file: string): void {
  fs.unlinkSync(path.join(pendingDir, file));
}

export type StatusSnapshot = Record<number, ProblemStatus>;

export function readSnapshot(): StatusSnapshot {
  if (!fs.existsSync(snapshotPath)) return {};
  return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
}

export function writeSnapshot(snapshot: StatusSnapshot): void {
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
}

// Matches the ChangelogEntry shape consumed by src/pages/index.astro.
export interface ChangelogEntry {
  date: string;
  type: "new-problem" | "status-change";
  id: number;
  name?: string;
  old_status?: string;
  new_status?: string;
}

export function readChangelog(): ChangelogEntry[] {
  if (!fs.existsSync(changelogPath)) return [];
  return JSON.parse(fs.readFileSync(changelogPath, "utf-8"));
}

export function writeChangelog(entries: ChangelogEntry[]): void {
  fs.writeFileSync(changelogPath, JSON.stringify(entries, null, 2) + "\n");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
