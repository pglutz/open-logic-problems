import { useEffect, useMemo, useState } from "react";
import { AREAS, type Area } from "../../lib/areas";
import type { ProblemIndexEntry, ProblemStatus } from "../../lib/problems";
import { STATUS_LABELS, IMPACT_RUBRIC, formatArea } from "../../lib/problems";

interface Props {
  problems: ProblemIndexEntry[];
}

type SortKey = "id" | "impact" | "status" | "area";

const STATUSES: ProblemStatus[] = ["open", "closed", "claimed-proof-no-consensus"];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "impact", label: "Impact" },
  { key: "status", label: "Status" },
  { key: "area", label: "Area" },
];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function ProblemListFilter({ problems }: Props) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ProblemStatus>>(new Set());
  const [selectedAreas, setSelectedAreas] = useState<Set<Area>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParams = params.getAll("status").filter((s): s is ProblemStatus =>
      STATUSES.includes(s as ProblemStatus),
    );
    const areaParams = params.getAll("area").filter((a): a is Area => AREAS.includes(a as Area));
    if (statusParams.length > 0) setSelectedStatuses(new Set(statusParams));
    if (areaParams.length > 0) setSelectedAreas(new Set(areaParams));
  }, []);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const statusOk = selectedStatuses.size === 0 || selectedStatuses.has(p.status);
      const areaOk = selectedAreas.size === 0 || p.area.some((a) => selectedAreas.has(a));
      return statusOk && areaOk;
    });
  }, [problems, selectedStatuses, selectedAreas]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "id":
          return (a.id - b.id) * dir;
        case "impact":
          return (a.impact - b.impact) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "area":
          return (a.area[0] ?? "").localeCompare(b.area[0] ?? "") * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="listing">
      <aside className="sidebar">
        <div className="filter-group">
          <h3>Status</h3>
          {STATUSES.map((s) => (
            <label className="checkbox-row" key={s}>
              <input
                type="checkbox"
                checked={selectedStatuses.has(s)}
                onChange={() => setSelectedStatuses((prev) => toggle(prev, s))}
              />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>Area</h3>
          {AREAS.map((a) => (
            <label className="checkbox-row" key={a}>
              <input
                type="checkbox"
                checked={selectedAreas.has(a)}
                onChange={() => setSelectedAreas((prev) => toggle(prev, a))}
              />
              {formatArea(a)}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>Sort by</h3>
          <div className="button-row">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={sortKey === opt.key ? "active" : ""}
                onClick={() => setSortKey(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h3>Direction</h3>
          <div className="button-row">
            <button
              type="button"
              className={sortDir === "asc" ? "active" : ""}
              onClick={() => setSortDir("asc")}
            >
              Ascending
            </button>
            <button
              type="button"
              className={sortDir === "desc" ? "active" : ""}
              onClick={() => setSortDir("desc")}
            >
              Descending
            </button>
          </div>
        </div>
      </aside>

      <div className="results">
        <p className="count muted">
          {sorted.length} problem{sorted.length === 1 ? "" : "s"}
        </p>

        <div className="cards">
          {sorted.map((p) => (
            <div className={`status-box card status-${p.status}`} key={p.id}>
              <div className="meta-row">
                <h3>
                  <a href={`/problems/${p.id}`}>{p.name ?? `Problem #${p.id}`}</a>
                </h3>
                <span className="impact" title={IMPACT_RUBRIC[p.impact]}>
                  {"!".repeat(p.impact)}
                </span>
              </div>
              <span className={`badge status-${p.status}`}>{STATUS_LABELS[p.status]}</span>
              <div className="area-row">
                {p.area.map((a) => (
                  <a className="area-tag" href={`/problems?area=${encodeURIComponent(a)}`} key={a}>
                    {formatArea(a)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .listing {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        @media (min-width: 800px) {
          .listing {
            flex-direction: row;
            align-items: flex-start;
          }
          .sidebar {
            flex: 0 0 200px;
            position: sticky;
            top: 1rem;
          }
          .results {
            flex: 1;
            min-width: 0;
          }
        }
        .filter-group {
          margin-bottom: 1.5rem;
        }
        .filter-group h3 {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          margin: 0 0 0.5rem;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.9rem;
          margin-bottom: 0.3rem;
        }
        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .button-row button {
          font: inherit;
          font-size: 0.85rem;
          padding: 0.3rem 0.65rem;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text);
          cursor: pointer;
        }
        .button-row button.active {
          background: var(--color-link);
          border-color: var(--color-link);
          color: #fff;
        }
        .count {
          margin-top: 0;
        }
        .cards {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .card {
          padding: 0.85rem 1.1rem;
        }
        .card .meta-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .card h3 {
          margin: 0;
          font-size: 1.05rem;
        }
        .card .impact {
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: help;
          white-space: nowrap;
        }
        .card .area-row {
          margin-top: 0.6rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .card .area-tag {
          display: inline-block;
          padding: 0.1rem 0.55rem;
          border-radius: 5px;
          background: rgba(128, 128, 128, 0.15);
          font-size: 0.85rem;
          text-decoration: none;
        }
        .card .area-tag:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
