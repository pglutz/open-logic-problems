import type { Area } from "./areas";

export type ProblemStatus = "open" | "closed" | "claimed-proof-no-consensus";

export interface ProblemIndexEntry {
  id: number;
  name?: string;
  status: ProblemStatus;
  area: Area[];
  impact: 1 | 2 | 3;
}

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  open: "Open",
  closed: "Closed",
  "claimed-proof-no-consensus": "Claimed proof, no consensus",
};

export const IMPACT_RUBRIC: Record<1 | 2 | 3, string> = {
  1: "Notable — every problem listed here is a genuine, worthwhile open problem",
  2: "Substantial — resolution would likely be publishable in a top journal (Advances-level or above)",
  3: "Landmark — resolution would be of award-level significance",
};

export function formatArea(area: string): string {
  return area
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
