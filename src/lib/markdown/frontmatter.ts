import {
  problemFrontmatterSchema,
  pendingProblemSchema,
  type ProblemFrontmatter,
  type PendingProblemFrontmatter,
} from "../problemSchema";

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

// Lines shared by an assigned problem and one still awaiting an id: name,
// status, area, impact, canonical_reference. Excludes `id` (bare int vs.
// literal `null`) — callers assemble that around this.
function coreFrontmatterLines(fm: {
  name: string;
  status: string;
  area: readonly string[];
  impact: number;
  canonical_reference: ProblemFrontmatter["canonical_reference"];
}): string[] {
  const lines = [
    `name: ${q(fm.name)}`,
    `status: ${fm.status}`,
    `area: [${fm.area.join(", ")}]`,
    `impact: ${fm.impact}`,
    `canonical_reference:`,
    `  title: ${q(fm.canonical_reference.title)}`,
    `  author: ${q(fm.canonical_reference.author)}`,
  ];
  if (fm.canonical_reference.venue) lines.push(`  venue: ${q(fm.canonical_reference.venue)}`);
  if (fm.canonical_reference.year) lines.push(`  year: ${fm.canonical_reference.year}`);
  if (fm.canonical_reference.link) lines.push(`  link: ${q(fm.canonical_reference.link)}`);
  if (fm.canonical_reference.doi) lines.push(`  doi: ${q(fm.canonical_reference.doi)}`);
  return lines;
}

export function serializeProblemFile(frontmatter: ProblemFrontmatter, body: string): string {
  const fm = problemFrontmatterSchema.parse(frontmatter);
  const lines = [`id: ${fm.id}`, ...coreFrontmatterLines(fm)];
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

export function serializePendingProblemFile(
  frontmatter: PendingProblemFrontmatter,
  body: string,
): string {
  const fm = pendingProblemSchema.parse(frontmatter);
  const lines = [`id: null`, ...coreFrontmatterLines(fm)];
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}
