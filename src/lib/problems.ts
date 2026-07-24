import type { Area } from "./areas";

export type ProblemStatus = "open" | "closed" | "claimed-proof-no-consensus";

export interface ProblemIndexEntry {
  id: number;
  name: string;
  status: ProblemStatus;
  area: Area[];
  impact: 1 | 2 | 3;
}

export const IMPACTS = [1, 2, 3] as const;

export const IMPACT_LABELS: Record<1 | 2 | 3, string> = {
  1: "!",
  2: "!!",
  3: "!!!",
};

export const IMPACT_SHORT_LABELS: Record<1 | 2 | 3, string> = {
  1: "Ordinary impact",
  2: "High impact",
  3: "Very high impact",
};

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  open: "Open",
  closed: "Closed",
  "claimed-proof-no-consensus": "No consensus",
};

export const IMPACT_RUBRIC: Record<1 | 2 | 3, string> = {
  1: "Ordinary impact — every problem listed here is a genuine, worthwhile open problem",
  2: "High impact — resolution would likely be publishable in a top journal (Advances-level or above)",
  3: "Very high impact — resolution would be of award-level significance",
};

export function formatArea(area: string): string {
  return area
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
