export type ProblemStatus = "open" | "closed" | "claimed-proof-no-consensus";

export interface ProblemIndexEntry {
  id: number;
  name?: string;
  status: ProblemStatus;
  area: string[];
  difficulty: 1 | 2 | 3;
}

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  open: "Open",
  closed: "Closed",
  "claimed-proof-no-consensus": "Claimed proof, no consensus",
};

export function formatArea(area: string): string {
  return area
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
