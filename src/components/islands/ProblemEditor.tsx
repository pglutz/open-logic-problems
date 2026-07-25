import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { OPEN_AUTH_POPOVER_EVENT } from "../../lib/authPopoverEvent";
import { renderMarkdown } from "../../lib/markdown/pipeline";
import { joinSections } from "../../lib/markdown/sections";
import { AREAS, type Area } from "../../lib/areas";
import {
  STATUS_LABELS,
  IMPACT_LABELS,
  IMPACT_RUBRIC,
  IMPACT_SHORT_LABELS,
  type ProblemStatus,
} from "../../lib/problems";
import { formatArea } from "../../lib/problems";

interface CanonicalReference {
  title: string;
  author: string;
  venue?: string;
  year?: number;
  link?: string;
  doi?: string;
}

interface ProblemSectionsInput {
  statement: string;
  definitions: string;
  partialResults: string;
  additionalReferences: string;
  notes: string;
}

interface ProblemEditorProps {
  problem: {
    id: number;
    name: string;
    status: ProblemStatus;
    area: Area[];
    impact: 1 | 2 | 3;
    canonicalReference: CanonicalReference;
  };
  sections: ProblemSectionsInput;
}

interface PreviewHtml {
  statement: string;
  definitions?: string;
  partialResults?: string;
  additionalReferences?: string;
  notes?: string;
}

export default function ProblemEditor({ problem, sections }: ProblemEditorProps) {
  const [session, setSession] = useState<Session | null>(null);

  const [name, setName] = useState(problem.name);
  const [status, setStatus] = useState<ProblemStatus>(problem.status);
  const [area, setArea] = useState<Area[]>(problem.area);
  const [impact, setImpact] = useState<1 | 2 | 3>(problem.impact);
  const [refTitle, setRefTitle] = useState(problem.canonicalReference.title);
  const [refAuthor, setRefAuthor] = useState(problem.canonicalReference.author);
  const [refVenue, setRefVenue] = useState(problem.canonicalReference.venue ?? "");
  const [refYear, setRefYear] = useState(
    problem.canonicalReference.year ? String(problem.canonicalReference.year) : "",
  );
  const [refLink, setRefLink] = useState(problem.canonicalReference.link ?? "");
  const [refDoi, setRefDoi] = useState(problem.canonicalReference.doi ?? "");

  const [statement, setStatement] = useState(sections.statement);
  const [definitions, setDefinitions] = useState(sections.definitions);
  const [partialResults, setPartialResults] = useState(sections.partialResults);
  const [additionalReferences, setAdditionalReferences] = useState(sections.additionalReferences);
  const [notes, setNotes] = useState(sections.notes);

  const [previewHtml, setPreviewHtml] = useState<PreviewHtml>({ statement: "" });
  const [commitMessage, setCommitMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ prUrl: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const renderIfPresent = (markdown: string) =>
        markdown.trim() ? renderMarkdown(markdown) : Promise.resolve(undefined);
      Promise.all([
        renderMarkdown(statement),
        renderIfPresent(definitions),
        renderIfPresent(partialResults),
        renderIfPresent(additionalReferences),
        renderIfPresent(notes),
      ]).then(([statementHtml, definitionsHtml, partialResultsHtml, additionalReferencesHtml, notesHtml]) => {
        setPreviewHtml({
          statement: statementHtml,
          definitions: definitionsHtml,
          partialResults: partialResultsHtml,
          additionalReferences: additionalReferencesHtml,
          notes: notesHtml,
        });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [statement, definitions, partialResults, additionalReferences, notes]);

  function toggleArea(a: Area) {
    setArea((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (area.length === 0) {
      setError("Select at least one area.");
      return;
    }
    if (!statement.trim()) {
      setError("The problem statement can't be empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/submit-problem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        problemId: problem.id,
        frontmatter: {
          id: problem.id,
          name,
          status,
          area,
          impact,
          canonical_reference: {
            title: refTitle,
            author: refAuthor,
            venue: refVenue || undefined,
            year: refYear ? Number(refYear) : undefined,
            link: refLink || undefined,
            doi: refDoi || undefined,
          },
        },
        body: joinSections({ statement, definitions, partialResults, additionalReferences, notes }),
        commitMessage,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.message ?? "Something went wrong.");
      return;
    }
    setResult({ prUrl: data.prUrl });
  }

  if (!session) {
    return (
      <p className="comment-signin-prompt">
        <button
          type="button"
          className="link-button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AUTH_POPOVER_EVENT))}
        >
          Sign in
        </button>{" "}
        to suggest an edit.
      </p>
    );
  }

  if (result) {
    return (
      <p className="comment-signin-prompt">
        Your suggested edit has been opened as a pull request:{" "}
        <a href={result.prUrl} target="_blank" rel="noreferrer">
          {result.prUrl}
        </a>
      </p>
    );
  }

  const title = name;

  return (
    <form className="problem-editor" onSubmit={handleSubmit}>
      <div className="editor-columns">
        <div className="editor-left">
          <div className="editor-field">
            <label>Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="editor-inline-row">
            <div className="editor-field editor-field-compact">
              <label>Status</label>
              <select
                className="editor-select-compact"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProblemStatus)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="editor-field editor-field-compact">
              <label>Impact</label>
              <select
                className="editor-select-compact"
                title={IMPACT_RUBRIC[impact]}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value) as 1 | 2 | 3)}
              >
                {([3, 2, 1] as const).map((n) => (
                  <option key={n} value={n} title={IMPACT_RUBRIC[n]}>
                    {IMPACT_LABELS[n]}
                    {"  "}
                    {IMPACT_SHORT_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {status !== problem.status && (
            <p className="editor-status-warning">
              You're changing this problem's status — status changes get extra scrutiny during
              review, so please make sure this is backed by a citable published result.
            </p>
          )}

          <details className="editor-collapsible">
            <summary>Area ({area.length} selected)</summary>
            <div className="editor-collapsible-body">
              <div className="editor-area-checkboxes">
                {AREAS.map((a) => (
                  <label key={a} className="editor-checkbox-label">
                    <input type="checkbox" checked={area.includes(a)} onChange={() => toggleArea(a)} />
                    {formatArea(a)}
                  </label>
                ))}
              </div>
            </div>
          </details>

          <details className="editor-collapsible">
            <summary>Reference</summary>
            <div className="editor-collapsible-body">
              <div className="editor-field">
                <label>Title</label>
                <input type="text" required value={refTitle} onChange={(e) => setRefTitle(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>Author(s)</label>
                <input type="text" required value={refAuthor} onChange={(e) => setRefAuthor(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>Venue (optional)</label>
                <input type="text" value={refVenue} onChange={(e) => setRefVenue(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>Year (optional)</label>
                <input type="number" value={refYear} onChange={(e) => setRefYear(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>Link (optional)</label>
                <input type="url" value={refLink} onChange={(e) => setRefLink(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>DOI (optional)</label>
                <input type="text" value={refDoi} onChange={(e) => setRefDoi(e.target.value)} />
              </div>
            </div>
          </details>

          <div className="editor-field">
            <label>Statement</label>
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={8} required />
          </div>
          <div className="editor-field">
            <label>Definitions (optional)</label>
            <textarea value={definitions} onChange={(e) => setDefinitions(e.target.value)} rows={5} />
          </div>
          <div className="editor-field">
            <label>Known Partial Results (optional)</label>
            <textarea value={partialResults} onChange={(e) => setPartialResults(e.target.value)} rows={5} />
          </div>
          <div className="editor-field">
            <label>Additional References (optional)</label>
            <textarea
              value={additionalReferences}
              onChange={(e) => setAdditionalReferences(e.target.value)}
              rows={4}
            />
          </div>
          <div className="editor-field">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>

          <div className="editor-field">
            <label>Summary of changes</label>
            <textarea
              className="editor-commit-message"
              required
              placeholder="e.g. Add a partial result from Smith (2024)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
          </div>

          <button type="submit" className="editor-submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit suggested edit"}
          </button>
          {error && <p className="comment-error">{error}</p>}
        </div>

        <div className="editor-right">
          <div className="editor-preview-page">
            <p className="muted editor-preview-id">Problem #{problem.id}</p>
            <h2 className="editor-preview-title">{title}</h2>

            <div className={`status-box editor-preview-statement-box status-${status}`}>
              <div className="editor-preview-meta-row">
                <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>
                <span className="editor-preview-impact" title={IMPACT_RUBRIC[impact]}>
                  {"!".repeat(impact)}
                </span>
              </div>
              <div
                className="editor-preview-statement-body"
                dangerouslySetInnerHTML={{ __html: previewHtml.statement }}
              />
              <div className="editor-preview-area-row">
                {area.map((a) => (
                  <span className="area-tag" key={a}>
                    {formatArea(a)}
                  </span>
                ))}
              </div>
            </div>

            <section className="editor-preview-section">
              <h3>Reference for the problem statement</h3>
              <p>
                {refAuthor}, <em>{refTitle}</em>
                {refVenue && <>, {refVenue}</>}
                {refYear && <>, {refYear}</>}
                {refLink && (
                  <>
                    {" "}
                    (<a href={refLink}>link</a>)
                  </>
                )}
                {refDoi && <> (DOI: {refDoi})</>}
              </p>
            </section>

            {previewHtml.definitions && (
              <section className="editor-preview-section">
                <h3>Definitions</h3>
                <div dangerouslySetInnerHTML={{ __html: previewHtml.definitions }} />
              </section>
            )}

            {previewHtml.partialResults && (
              <section className="editor-preview-section">
                <h3>Known Partial Results</h3>
                <div dangerouslySetInnerHTML={{ __html: previewHtml.partialResults }} />
              </section>
            )}

            {previewHtml.notes && (
              <section className="editor-preview-section">
                <h3>Notes</h3>
                <div dangerouslySetInnerHTML={{ __html: previewHtml.notes }} />
              </section>
            )}

            {previewHtml.additionalReferences && (
              <section className="editor-preview-section">
                <h3>Additional References</h3>
                <div dangerouslySetInnerHTML={{ __html: previewHtml.additionalReferences }} />
              </section>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
