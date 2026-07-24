// The canonical, maintained list of problem areas. Kept deliberately small and
// coarse-grained (e.g. stability theory and reverse mathematics fold into
// model-theory/proof-theory rather than getting their own entries) — add new
// areas here as needed, updating existing problems' `area` fields to match.
export const AREAS = [
  "computability-theory",
  "set-theory",
  "model-theory",
  "descriptive-set-theory",
  "proof-theory",
  "categorical-logic",
] as const;

export type Area = (typeof AREAS)[number];
