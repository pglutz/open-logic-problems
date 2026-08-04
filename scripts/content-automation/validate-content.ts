// Run on every pull request touching problems/** (see
// .github/workflows/validate-content.yml). Gives hand-authored PRs the same
// schema checking the website's own editor gets for free via Zod, plus one
// check the per-file schema can't express on its own: collection-wide id
// uniqueness. Read-only — never writes back to the repo.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter } from "../../src/lib/markdown/frontmatter.ts";
import { problemFrontmatterSchema, pendingProblemSchema } from "../../src/lib/problemSchema.ts";
import { repoRoot } from "./lib.ts";

const problemsDir = path.join(repoRoot, "problems");
const pendingDir = path.join(problemsDir, "pending");

function readMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function main(): void {
  let hasErrors = false;
  const seenIds = new Map<number, string>();

  for (const file of readMarkdownFiles(problemsDir)) {
    const raw = fs.readFileSync(path.join(problemsDir, file), "utf-8");
    try {
      const { data } = parseFrontmatter(raw);
      const frontmatter = problemFrontmatterSchema.parse(data);
      const existing = seenIds.get(frontmatter.id);
      if (existing) {
        console.error(
          `problems/${file}: duplicate id ${frontmatter.id} (already used by problems/${existing})`,
        );
        hasErrors = true;
      } else {
        seenIds.set(frontmatter.id, file);
      }
    } catch (err) {
      console.error(`problems/${file}: invalid frontmatter\n${err}`);
      hasErrors = true;
    }
  }

  for (const file of readMarkdownFiles(pendingDir)) {
    const raw = fs.readFileSync(path.join(pendingDir, file), "utf-8");
    try {
      const { data } = parseFrontmatter(raw);
      pendingProblemSchema.parse(data);
    } catch (err) {
      console.error(`problems/pending/${file}: invalid frontmatter\n${err}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\nContent validation failed.");
    process.exit(1);
  }
  console.log(`Content validation passed: ${seenIds.size} problem(s) OK.`);
}

main();
