import { useEffect, useMemo, useState } from "react";
import type { ProblemIndexEntry, ProblemStatus } from "../../lib/problems";
import { STATUS_LABELS, formatArea } from "../../lib/problems";

interface Props {
  problems: ProblemIndexEntry[];
}

type SortKey = "id" | "difficulty" | "status" | "area";

const STATUS_OPTIONS: (ProblemStatus | "all")[] = [
  "all",
  "open",
  "closed",
  "claimed-proof-no-consensus",
];

export default function ProblemListFilter({ problems }: Props) {
  const allAreas = useMemo(
    () => Array.from(new Set(problems.flatMap((p) => p.area))).sort(),
    [problems],
  );

  const [status, setStatus] = useState<ProblemStatus | "all">("all");
  const [area, setArea] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    const areaParam = params.get("area");
    if (statusParam && STATUS_OPTIONS.includes(statusParam as ProblemStatus)) {
      setStatus(statusParam as ProblemStatus);
    }
    if (areaParam && allAreas.includes(areaParam)) {
      setArea(areaParam);
    }
  }, [allAreas]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (area !== "all" && !p.area.includes(area)) return false;
      return true;
    });
  }, [problems, status, area]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "id":
          return (a.id - b.id) * dir;
        case "difficulty":
          return (a.difficulty - b.difficulty) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "area":
          return (a.area[0] ?? "").localeCompare(b.area[0] ?? "") * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div>
      <div className="controls">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as ProblemStatus | "all")}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Area
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All</option>
            {allAreas.map((a) => (
              <option key={a} value={a}>
                {formatArea(a)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort by
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="id">ID</option>
            <option value="difficulty">Difficulty</option>
            <option value="status">Status</option>
            <option value="area">Area</option>
          </select>
        </label>

        <button type="button" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
          {sortDir === "asc" ? "↑ Ascending" : "↓ Descending"}
        </button>
      </div>

      <p className="count muted">
        {sorted.length} problem{sorted.length === 1 ? "" : "s"}
      </p>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Status</th>
            <th>Area</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                <a href={`/problems/${p.id}`}>{p.name ?? `Problem #${p.id}`}</a>
              </td>
              <td>{STATUS_LABELS[p.status]}</td>
              <td>{p.area.map(formatArea).join(", ")}</td>
              <td>{"!".repeat(p.difficulty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          margin-bottom: 1rem;
        }
        .controls label {
          display: flex;
          flex-direction: column;
          font-size: 0.85rem;
          gap: 0.25rem;
        }
        .count {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
