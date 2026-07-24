import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS, type Area } from "../../lib/areas";
import type { ProblemIndexEntry, ProblemStatus } from "../../lib/problems";
import { STATUS_LABELS, IMPACTS, IMPACT_LABELS, IMPACT_RUBRIC, formatArea } from "../../lib/problems";

interface Props {
  problems: ProblemIndexEntry[];
}

type SortKey = "id" | "impact" | "status";
type Impact = 1 | 2 | 3;

const STATUSES: ProblemStatus[] = ["open", "closed", "claimed-proof-no-consensus"];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "impact", label: "Impact" },
  { key: "status", label: "Status" },
];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface FilterGroupProps<T extends string | number> {
  title: string;
  items: readonly T[];
  labels: Record<T, string>;
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
}

function FilterGroup<T extends string | number>({ title, items, labels, selected, onChange }: FilterGroupProps<T>) {
  const allSelected = selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="filter-group">
      <h3>{title}</h3>
      <label className="checkbox-row all-row">
        <input
          type="checkbox"
          ref={allRef}
          checked={allSelected}
          onChange={() => onChange(allSelected ? new Set() : new Set(items))}
        />
        All
      </label>
      {items.map((item) => (
        <label className="checkbox-row" key={item}>
          <input
            type="checkbox"
            checked={selected.has(item)}
            onChange={() => onChange(toggle(selected, item))}
          />
          {labels[item]}
        </label>
      ))}
    </div>
  );
}

export default function ProblemListFilter({ problems }: Props) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ProblemStatus>>(new Set(STATUSES));
  const [selectedAreas, setSelectedAreas] = useState<Set<Area>>(new Set(AREAS));
  const [selectedImpacts, setSelectedImpacts] = useState<Set<Impact>>(new Set(IMPACTS));
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParams = params.getAll("status").filter((s): s is ProblemStatus =>
      STATUSES.includes(s as ProblemStatus),
    );
    const areaParams = params.getAll("area").filter((a): a is Area => AREAS.includes(a as Area));
    const impactParams = params
      .getAll("impact")
      .map((v) => Number(v))
      .filter((v): v is Impact => (IMPACTS as readonly number[]).includes(v));
    if (statusParams.length > 0) setSelectedStatuses(new Set(statusParams));
    if (areaParams.length > 0) setSelectedAreas(new Set(areaParams));
    if (impactParams.length > 0) setSelectedImpacts(new Set(impactParams));
  }, []);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const statusOk = selectedStatuses.has(p.status);
      const areaOk = p.area.some((a) => selectedAreas.has(a));
      const impactOk = selectedImpacts.has(p.impact);
      return statusOk && areaOk && impactOk;
    });
  }, [problems, selectedStatuses, selectedAreas, selectedImpacts]);

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
      }
    });
  }, [filtered, sortKey, sortDir]);

  const areaLabels = useMemo(
    () => Object.fromEntries(AREAS.map((a) => [a, formatArea(a)])) as Record<Area, string>,
    [],
  );

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => toggle(prev, id));
  }

  return (
    <div className="listing">
      <aside className="sidebar">
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

        <h2 className="sidebar-heading">Filters</h2>

        <FilterGroup
          title="Status"
          items={STATUSES}
          labels={STATUS_LABELS}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />

        <FilterGroup
          title="Area"
          items={AREAS}
          labels={areaLabels}
          selected={selectedAreas}
          onChange={setSelectedAreas}
        />

        <FilterGroup
          title="Impact"
          items={IMPACTS}
          labels={IMPACT_LABELS}
          selected={selectedImpacts}
          onChange={setSelectedImpacts}
        />
      </aside>

      <div className="results">
        <p className="count muted">
          {sorted.length} problem{sorted.length === 1 ? "" : "s"}
        </p>

        <div className="cards">
          {sorted.map((p) => {
            const expanded = expandedIds.has(p.id);
            return (
              <div className={`status-box card status-${p.status}`} key={p.id}>
                <div className="meta-row">
                  <span className="problem-id muted">#{p.id}</span>
                  <h3>
                    <a href={`/problems/${p.id}`}>{p.name ?? `Problem #${p.id}`}</a>
                  </h3>
                  <span className={`badge status-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                  <span className="impact" title={IMPACT_RUBRIC[p.impact]}>
                    {"!".repeat(p.impact)}
                  </span>
                </div>
                <div className="area-row">
                  {p.area.map((a) => (
                    <a className="area-tag" href={`/problems?area=${encodeURIComponent(a)}`} key={a}>
                      {formatArea(a)}
                    </a>
                  ))}
                  <button
                    type="button"
                    className="expand-toggle"
                    onClick={() => toggleExpanded(p.id)}
                    aria-expanded={expanded}
                  >
                    {expanded ? "Hide statement ▲" : "Show statement ▼"}
                  </button>
                </div>
                {expanded && (
                  <div className="statement-preview" dangerouslySetInnerHTML={{ __html: p.statementHtml }} />
                )}
              </div>
            );
          })}
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
        .sidebar-heading {
          font-size: 1rem;
          margin: 0 0 0.75rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
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
        .all-row {
          font-weight: 600;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.35rem;
          margin-bottom: 0.35rem;
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
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .card .problem-id {
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .card h3 {
          margin: 0;
          font-size: 1.05rem;
          flex: 1;
          min-width: 0;
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
          align-items: center;
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
        .expand-toggle {
          margin-left: auto;
          font: inherit;
          font-size: 0.8rem;
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
        }
        .expand-toggle:hover {
          color: var(--color-text);
        }
        .statement-preview {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
          font-size: 0.95rem;
        }
        .statement-preview p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
