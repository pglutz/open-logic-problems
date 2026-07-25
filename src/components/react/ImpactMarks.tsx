import { IMPACT_RUBRIC } from "../../lib/problems";

export default function ImpactMarks({ impact }: { impact: 1 | 2 | 3 }) {
  return (
    <span className="impact" title={IMPACT_RUBRIC[impact]}>
      {"!".repeat(impact)}
      <span className="visually-hidden">{IMPACT_RUBRIC[impact]}</span>
    </span>
  );
}
