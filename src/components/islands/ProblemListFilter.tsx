import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AREAS, type Area } from "../../lib/areas";
import type { ProblemIndexEntry, ProblemStatus } from "../../lib/problems";
import {
  STATUSES,
  STATUS_LABELS,
  IMPACTS,
  IMPACT_LABELS,
  IMPACT_SHORT_LABELS,
  IMPACT_RUBRIC,
  formatArea,
} from "../../lib/problems";

interface Props {
  problems: ProblemIndexEntry[];
}

type SortKey = "id" | "impact" | "status";
type Impact = 1 | 2 | 3;

// Highest impact first — filtering for the most significant problems is the more common intent.
const impactFilterOrder: Impact[] = [...IMPACTS].reverse();

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "impact", label: "Impact" },
  { key: "status", label: "Status" },
];

// useLayoutEffect warns when it runs during server rendering (it's a no-op
// there); fall back to useEffect in that environment to keep the SSR log
// clean, while still getting layout-effect timing (before paint) in the
// browser, where it matters for avoiding a flash.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  renderLabel?: (item: T) => React.ReactNode;
}

function FilterGroup<T extends string | number>({
  title,
  items,
  labels,
  selected,
  onChange,
  renderLabel,
}: FilterGroupProps<T>) {
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
          {renderLabel ? renderLabel(item) : labels[item]}
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
  const [filtersOpen, setFiltersOpen] = useState(true);

  // useLayoutEffect (not useEffect) so this runs before the browser paints,
  // avoiding a visible open-then-collapse flash on narrow screens.
  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia("(max-width: 799px)").matches) setFiltersOpen(false);
  }, []);

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
          return (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const areaLabels = useMemo(
    () => Object.fromEntries(AREAS.map((a) => [a, formatArea(a)])) as Record<Area, string>,
    [],
  );

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
          <div className="direction-toggle" data-active={sortDir}>
            <div className="direction-toggle-slider" aria-hidden="true" />
            <button
              type="button"
              className={`direction-toggle-option${sortDir === "asc" ? " direction-toggle-active" : ""}`}
              onClick={() => setSortDir("asc")}
            >
              Ascending
            </button>
            <button
              type="button"
              className={`direction-toggle-option${sortDir === "desc" ? " direction-toggle-active" : ""}`}
              onClick={() => setSortDir("desc")}
            >
              Descending
            </button>
          </div>
        </div>

        <details
          className="filters-details"
          open={filtersOpen}
          onToggle={(e) => setFiltersOpen(e.currentTarget.open)}
        >
          <summary className="sidebar-heading filters-summary">Filters</summary>

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
            items={impactFilterOrder}
            labels={IMPACT_SHORT_LABELS}
            selected={selectedImpacts}
            onChange={setSelectedImpacts}
            renderLabel={(n) => (
              <>
                <span className="impact-bangs">{IMPACT_LABELS[n]}</span>
                <span>{IMPACT_SHORT_LABELS[n]}</span>
              </>
            )}
          />
        </details>
      </aside>

      <div className="results">
        <p className="count muted">
          {sorted.length} problem{sorted.length === 1 ? "" : "s"}
        </p>

        <div className="cards">
          {sorted.map((p) => (
            <div className={`status-box card status-${p.status}`} key={p.id}>
              <a href={`/problems/${p.id}`} className="card-stretched-link" aria-label={p.name} />
              <div className="meta-row">
                <span className="problem-id muted">#{p.id}</span>
                <h3 className="card-title-plain">{p.name}</h3>
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
                <span className={`badge status-${p.status} status-badge-end`}>{STATUS_LABELS[p.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .listing {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        @media (min-width: 800px) {
          .listing {
            flex-direction: row;
            align-items: flex-start;
            gap: 2rem;
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
        .filters-summary {
          cursor: pointer;
          font-weight: 600;
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
        .impact-bangs {
          display: inline-block;
          min-width: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.05em;
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
          border-radius: var(--radius-md);
          border: var(--border-width) solid var(--color-border);
          background: transparent;
          color: var(--color-text);
          cursor: pointer;
        }
        .button-row button.active {
          background: var(--color-link);
          border-color: var(--color-link);
          color: #fff;
        }
        .direction-toggle {
          position: relative;
          display: flex;
          width: fit-content;
          border: var(--border-width) solid var(--color-border);
          border-radius: var(--radius-pill);
          background: var(--color-bg);
          padding: 0.12rem;
        }
        .direction-toggle-slider {
          position: absolute;
          top: 0.12rem;
          bottom: 0.12rem;
          left: 0.12rem;
          width: calc(50% - 0.12rem);
          border-radius: var(--radius-pill);
          background: var(--color-link);
          transition: transform 0.2s ease;
        }
        .direction-toggle[data-active="desc"] .direction-toggle-slider {
          transform: translateX(100%);
        }
        .direction-toggle-option {
          position: relative;
          z-index: 1;
          flex: 1 1 50%;
          font: inherit;
          font-size: 0.85rem;
          padding: 0.3rem 0.64rem;
          border: none;
          background: transparent;
          color: var(--color-text);
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .direction-toggle-active {
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
          position: relative;
          padding: 0.85rem 1.1rem;
          transition: filter 0.1s ease;
        }
        .card:hover {
          filter: saturate(1.15) brightness(0.98);
        }
        .card-stretched-link {
          position: absolute;
          inset: 0;
        }
        .card-title-plain {
          color: color-mix(in srgb, var(--color-text) 80%, var(--color-bg) 20%);
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
          margin-left: auto;
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
        .card .status-badge-end {
          margin-left: auto;
          margin-right: -0.1rem;
        }
        .card .area-tag {
          position: relative;
          display: inline-block;
          padding: 0.1rem 0.55rem;
          border-radius: var(--radius-sm);
          background: rgba(128, 128, 128, 0.2);
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
