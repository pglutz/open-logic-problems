import * as yaml from "js-yaml";
import {
  problemFrontmatterSchema,
  pendingProblemSchema,
  type ProblemFrontmatter,
  type PendingProblemFrontmatter,
} from "../problemSchema.ts";

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

// Writes one reference's fields (key, title, author, then whichever of
// venue/year/link/doi are present) at the given indent — shared by
// canonical_reference and each entry of the references array below.
function referenceLines(ref: ProblemFrontmatter["canonical_reference"], indent: string): string[] {
  const lines: string[] = [];
  if (ref.key) lines.push(`${indent}key: ${q(ref.key)}`);
  lines.push(`${indent}title: ${q(ref.title)}`, `${indent}author: ${q(ref.author)}`);
  if (ref.venue) lines.push(`${indent}venue: ${q(ref.venue)}`);
  if (ref.year) lines.push(`${indent}year: ${ref.year}`);
  if (ref.link) lines.push(`${indent}link: ${q(ref.link)}`);
  if (ref.doi) lines.push(`${indent}doi: ${q(ref.doi)}`);
  return lines;
}

// Lines shared by an assigned problem and one still awaiting an id: name,
// status, area, impact, canonical_reference, references. Excludes `id` (bare
// int vs. literal `null`) — callers assemble that around this.
function coreFrontmatterLines(fm: {
  name: string;
  status: string;
  area: readonly string[];
  impact: number;
  canonical_reference: ProblemFrontmatter["canonical_reference"];
  references: ProblemFrontmatter["references"];
}): string[] {
  const lines = [
    `name: ${q(fm.name)}`,
    `status: ${fm.status}`,
    `area: [${fm.area.join(", ")}]`,
    `impact: ${fm.impact}`,
    `canonical_reference:`,
    ...referenceLines(fm.canonical_reference, "  "),
  ];
  if (fm.references.length > 0) {
    lines.push(`references:`);
    for (const ref of fm.references) {
      const [firstLine, ...restLines] = referenceLines(ref, "    ");
      lines.push(`  - ${firstLine.trimStart()}`, ...restLines);
    }
  }
  return lines;
}

export function serializeProblemFile(frontmatter: ProblemFrontmatter, body: string): string {
  const fm = problemFrontmatterSchema.parse(frontmatter);
  const lines = [`id: ${fm.id}`, ...coreFrontmatterLines(fm)];
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

// Used only by the content-automation CI scripts, which read files after
// they've already been through human PR review — unlike serialize*, which
// controls the app's own output format exactly, this only needs to tolerate
// whatever valid YAML a reviewer actually merged.
export function parseFrontmatter(raw: string): { data: unknown; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("No frontmatter block found");
  const [, frontmatterYaml, body] = match;
  return { data: yaml.load(frontmatterYaml), body: body.trim() };
}

export function serializePendingProblemFile(
  frontmatter: PendingProblemFrontmatter,
  body: string,
): string {
  const fm = pendingProblemSchema.parse(frontmatter);
  const lines = [`id: null`, ...coreFrontmatterLines(fm)];
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}
