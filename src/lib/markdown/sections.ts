export interface ProblemSections {
  statement: string;
  definitions?: string;
  partialResults?: string;
  additionalReferences?: string;
  notes?: string;
}

type SectionKey = keyof ProblemSections;

const HEADING_ALIASES: Record<string, SectionKey> = {
  statement: "statement",
  definitions: "definitions",
  "known partial results": "partialResults",
  "partial results": "partialResults",
  "additional references": "additionalReferences",
  notes: "notes",
};

/**
 * Splits a problem's raw body Markdown into named sections by top-level
 * ("## Heading") headings. Everything before the first recognized heading
 * (or under an explicit "## Statement") is the statement, which the layout
 * renders inside the status-colored box; the rest render as separate
 * sections below it.
 */
export function splitSections(markdown: string): ProblemSections {
  const lines = markdown.split(/\r?\n/);
  const buckets = new Map<SectionKey, string[]>([["statement", []]]);
  let current: SectionKey = "statement";

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      const heading = match[1].trim().toLowerCase();
      const key = HEADING_ALIASES[heading];
      if (key) {
        current = key;
        if (!buckets.has(current)) buckets.set(current, []);
        continue;
      }
    }
    buckets.get(current)!.push(line);
  }

  const get = (key: SectionKey) => buckets.get(key)?.join("\n").trim();

  return {
    statement: get("statement") ?? "",
    definitions: get("definitions") || undefined,
    partialResults: get("partialResults") || undefined,
    additionalReferences: get("additionalReferences") || undefined,
    notes: get("notes") || undefined,
  };
}

const SECTION_ORDER: SectionKey[] = [
  "statement",
  "definitions",
  "partialResults",
  "additionalReferences",
  "notes",
];

const SECTION_HEADINGS: Record<SectionKey, string> = {
  statement: "Statement",
  definitions: "Definitions",
  partialResults: "Known Partial Results",
  additionalReferences: "Additional References",
  notes: "Notes",
};

/** Inverse of splitSections: reassembles named sections into one Markdown body. */
export function joinSections(sections: ProblemSections): string {
  const parts: string[] = [];
  for (const key of SECTION_ORDER) {
    const content = sections[key]?.trim();
    if (!content) continue;
    parts.push(`## ${SECTION_HEADINGS[key]}\n\n${content}`);
  }
  return parts.join("\n\n") + "\n";
}
