import { STATUS_LABELS, type ProblemStatus } from "../../lib/problems";

export default function StatusBadge({ status }: { status: ProblemStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}
