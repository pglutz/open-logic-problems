import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter, serializeProblemFile } from "../../src/lib/markdown/frontmatter.ts";
import { extractNotifyMarker } from "../../src/lib/email.ts";
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
  // Raw (still-encrypted) marker, if the submission form embedded one — see
  // buildNotifyMarker in src/lib/email.ts. Stripped out of `body` here so it
  // never ends up in the final, permanent problems/<id>.md file.
  notifyMarker: string | null;
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
    const notifyMarker = extractNotifyMarker(body);
    const cleanBody = body.replace(/\n*<!-- opl-notify:[A-Za-z0-9+/=]+ -->\n*/, "\n").trim();
    return { file, frontmatter: pendingProblemSchema.parse(data), body: cleanBody, notifyMarker };
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

export interface PendingNotification {
  id: number;
  marker: string;
}

// Written by assign-ids.ts, read by notify-assigned.ts — deliberately
// outside the repo checkout (RUNNER_TEMP, a directory GitHub Actions
// provides for exactly this) so it's never at risk of being swept up by the
// "Commit and push if changed" step's `git add -A`. Splitting id-assignment
// from actually emailing submitters into two steps lets the workflow only
// send mail once the assignment has genuinely been committed and pushed —
// notify-assigned.ts runs after that step, and GitHub Actions skips later
// steps by default if an earlier one fails, so a failed push means no email
// goes out either.
function notificationsPath(): string {
  return path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "opl-pending-notifications.json");
}

export function writePendingNotifications(notifications: PendingNotification[]): void {
  fs.writeFileSync(notificationsPath(), JSON.stringify(notifications, null, 2));
}

export function readPendingNotifications(): PendingNotification[] {
  const p = notificationsPath();
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
