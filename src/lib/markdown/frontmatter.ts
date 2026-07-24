import * as yaml from "js-yaml";
import { problemFrontmatterSchema, type ProblemFrontmatter } from "../problemSchema";

export interface ParsedProblemFile {
  frontmatter: ProblemFrontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseProblemFile(raw: string): ParsedProblemFile {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) throw new Error("File does not start with a valid --- frontmatter block");
  const [, yamlBlock, body] = match;
  const frontmatter = problemFrontmatterSchema.parse(yaml.load(yamlBlock));
  return { frontmatter, body };
}

// The schema is small and fixed, so rather than relying on js-yaml's dump()
// heuristics for the whole object (which either drops quotes from prose
// strings whenever they're not strictly required for parsing, or — with
// forceQuotes — also quotes and type-tags numbers as `!!int "1"`, which
// looks worse), each field is written out by hand to match the original
// hand-authored convention: bare numbers/enum values, double-quoted prose
// strings, flow-style area array. JSON.stringify produces a valid
// double-quoted YAML scalar for our purposes (its escaping is a subset of
// YAML's double-quote escaping).
const q = (s: string) => JSON.stringify(s);

export function serializeProblemFile(frontmatter: ProblemFrontmatter, body: string): string {
  const fm = problemFrontmatterSchema.parse(frontmatter);
  const lines: string[] = [`id: ${fm.id}`];
  if (fm.name) lines.push(`name: ${q(fm.name)}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`area: [${fm.area.join(", ")}]`);
  lines.push(`impact: ${fm.impact}`);
  lines.push(`canonical_reference:`);
  lines.push(`  title: ${q(fm.canonical_reference.title)}`);
  lines.push(`  author: ${q(fm.canonical_reference.author)}`);
  if (fm.canonical_reference.venue) lines.push(`  venue: ${q(fm.canonical_reference.venue)}`);
  if (fm.canonical_reference.year) lines.push(`  year: ${fm.canonical_reference.year}`);
  if (fm.canonical_reference.link) lines.push(`  link: ${q(fm.canonical_reference.link)}`);

  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}
