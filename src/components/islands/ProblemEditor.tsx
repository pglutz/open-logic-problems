import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { OPEN_AUTH_POPOVER_EVENT } from "../../lib/authPopoverEvent";
import { renderMarkdown, renderIfPresent } from "../../lib/markdown/pipeline";
import { joinSections, type ProblemSections } from "../../lib/markdown/sections";
import { AREAS, type Area } from "../../lib/areas";
import {
  STATUS_LABELS,
  IMPACT_LABELS,
  IMPACT_RUBRIC,
  IMPACT_SHORT_LABELS,
  type ProblemStatus,
} from "../../lib/problems";
import { formatArea } from "../../lib/problems";
import ProblemBody from "../react/ProblemBody";
import type { CanonicalReference } from "../../lib/problemSchema";

// Every field is required here (unlike ProblemSections, where they're
// optional) — the editor always seeds its textareas with a definite string,
// using "" rather than undefined for an absent section.
type ProblemSectionsInput = Required<ProblemSections>;

const EMPTY_SECTIONS: ProblemSectionsInput = {
  statement: "",
  definitions: "",
  partialResults: "",
  additionalReferences: "",
  notes: "",
};

interface ProblemEditorProps {
  mode?: "edit" | "new";
  // Required in "edit" mode, absent in "new" mode.
  problem?: {
    id: number;
    name: string;
    status: ProblemStatus;
    area: Area[];
    impact: 1 | 2 | 3;
    canonicalReference: CanonicalReference;
  };
  sections?: ProblemSectionsInput;
}

interface PreviewHtml {
  statement: string;
  definitions?: string;
  partialResults?: string;
  additionalReferences?: string;
  notes?: string;
}

export default function ProblemEditor({ mode = "edit", problem, sections }: ProblemEditorProps) {
  const [session, setSession] = useState<Session | null>(null);

  // A brand-new proposal has no prior on-disk status to compare against —
  // treat "open" as the baseline instead, so the existing status-warning
  // condition below (`status !== baselineStatus`) needs no new branching.
  const baselineStatus: ProblemStatus = mode === "new" ? "open" : problem!.status;
  const initialSections = sections ?? EMPTY_SECTIONS;

  const [name, setName] = useState(problem?.name ?? "");
  const [status, setStatus] = useState<ProblemStatus>(baselineStatus);
  const [area, setArea] = useState<Area[]>(problem?.area ?? []);
  const [impact, setImpact] = useState<1 | 2 | 3>(problem?.impact ?? 1);
  const [refTitle, setRefTitle] = useState(problem?.canonicalReference.title ?? "");
  const [refAuthor, setRefAuthor] = useState(problem?.canonicalReference.author ?? "");
  const [refVenue, setRefVenue] = useState(problem?.canonicalReference.venue ?? "");
  const [refYear, setRefYear] = useState(
    problem?.canonicalReference.year ? String(problem.canonicalReference.year) : "",
  );
  const [refLink, setRefLink] = useState(problem?.canonicalReference.link ?? "");
  const [refDoi, setRefDoi] = useState(problem?.canonicalReference.doi ?? "");

  const [statement, setStatement] = useState(initialSections.statement);
  const [definitions, setDefinitions] = useState(initialSections.definitions);
  const [partialResults, setPartialResults] = useState(initialSections.partialResults);
  const [additionalReferences, setAdditionalReferences] = useState(initialSections.additionalReferences);
  const [notes, setNotes] = useState(initialSections.notes);

  const [previewHtml, setPreviewHtml] = useState<PreviewHtml>({ statement: "" });
  const [commitMessage, setCommitMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ prUrl: string } | null>(null);

  // Which required fields were blank *at the last submit attempt* — a
  // snapshot, not a live computation, so blanking a field out after a failed
  // submit doesn't newly highlight it until the user tries submitting again.
  // A field already in this set still stops being highlighted the moment
  // it's filled in, since the render below ANDs this with the field's
  // current (live) blank-ness.
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
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

  const missingName = !name.trim();
  const missingArea = area.length === 0;
  const missingStatement = !statement.trim();
  const missingCommitMessage = mode === "edit" && !commitMessage.trim();
  const hasValidationErrors = missingName || missingArea || missingStatement || missingCommitMessage;

  const referenceTitleBlank = !refTitle.trim();
  const referenceAuthorBlank = !refAuthor.trim();
  let referenceWarning: string | null = null;
  if (referenceTitleBlank && referenceAuthorBlank) {
    referenceWarning =
      "No reference has been provided. Most problems should include a reference to a reliable published source — leave this blank only in unusual cases.";
  } else if (referenceTitleBlank) {
    referenceWarning = "This reference is missing a title.";
  } else if (referenceAuthorBlank) {
    referenceWarning = "This reference is missing an author.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (hasValidationErrors) {
      const missing = new Set<string>();
      if (missingName) missing.add("name");
      if (missingArea) missing.add("area");
      if (missingStatement) missing.add("statement");
      if (missingCommitMessage) missing.add("commitMessage");
      setInvalidFields(missing);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setInvalidFields(new Set());
    setSubmitting(true);
    setError(null);

    const commonFrontmatter = {
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
    };
    const bodyContent = joinSections({ statement, definitions, partialResults, additionalReferences, notes });
    const effectiveCommitMessage = commitMessage.trim() || `New problem proposal: ${name}`;

    const endpoint = mode === "new" ? "/api/submit-new-problem" : "/api/submit-problem";
    const requestBody =
      mode === "new"
        ? {
            frontmatter: { id: null, ...commonFrontmatter },
            body: bodyContent,
            commitMessage: effectiveCommitMessage,
          }
        : {
            problemId: problem!.id,
            frontmatter: { id: problem!.id, ...commonFrontmatter },
            body: bodyContent,
            commitMessage: effectiveCommitMessage,
          };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
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
        to {mode === "new" ? "propose a new problem" : "suggest an edit"}.
      </p>
    );
  }

  if (result) {
    return (
      <p className="comment-signin-prompt">
        Your {mode === "new" ? "problem proposal" : "suggested edit"} has been opened as a pull
        request:{" "}
        <a href={result.prUrl} target="_blank" rel="noreferrer">
          {result.prUrl}
        </a>
      </p>
    );
  }

  const nameInvalid = invalidFields.has("name") && missingName;
  const areaInvalid = invalidFields.has("area") && missingArea;
  const statementInvalid = invalidFields.has("statement") && missingStatement;
  const commitMessageInvalid = invalidFields.has("commitMessage") && missingCommitMessage;
  const showValidationSummary = nameInvalid || areaInvalid || statementInvalid || commitMessageInvalid;

  return (
    <form className="problem-editor" onSubmit={handleSubmit} noValidate>
      <div className="editor-columns">
        <div className="editor-left">
          {showValidationSummary && (
            <p className="editor-error-box">One or more required fields are blank.</p>
          )}
          <div className={`editor-field editor-field-full-width${nameInvalid ? " editor-field-invalid" : ""}`}>
            <label>Title</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <details className={`editor-collapsible${areaInvalid ? " editor-collapsible-invalid" : ""}`}>
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
          {status !== baselineStatus && (
            <p className="editor-status-warning">
              {mode === "new"
                ? "Proposing a problem with a non-open status gets extra scrutiny during review, so please make sure this is backed by a citable published result."
                : "You're changing this problem's status — status changes get extra scrutiny during review, so please make sure this is backed by a citable published result."}
            </p>
          )}

          <div className={`editor-field${statementInvalid ? " editor-field-invalid" : ""}`}>
            <label>Statement</label>
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={8} />
          </div>

          <details className="editor-collapsible">
            <summary>Reference for the problem statement</summary>
            <div className="editor-collapsible-body">
              <div className="editor-field">
                <label>Title (optional)</label>
                <input type="text" value={refTitle} onChange={(e) => setRefTitle(e.target.value)} />
              </div>
              <div className="editor-field">
                <label>Author(s) (optional)</label>
                <input type="text" value={refAuthor} onChange={(e) => setRefAuthor(e.target.value)} />
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
          {referenceWarning && <p className="editor-status-warning">{referenceWarning}</p>}

          <div className="editor-field">
            <label>Definitions (optional)</label>
            <textarea value={definitions} onChange={(e) => setDefinitions(e.target.value)} rows={5} />
          </div>
          <div className="editor-field">
            <label>Known Partial Results (optional)</label>
            <textarea value={partialResults} onChange={(e) => setPartialResults(e.target.value)} rows={5} />
          </div>
          <div className="editor-field">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          <div className="editor-field">
            <label>Additional References (optional)</label>
            <textarea
              value={additionalReferences}
              onChange={(e) => setAdditionalReferences(e.target.value)}
              rows={4}
            />
          </div>

          {mode === "edit" && (
            <div className={`editor-field${commitMessageInvalid ? " editor-field-invalid" : ""}`}>
              <label>Summary of changes</label>
              <textarea
                className="editor-commit-message"
                placeholder="e.g. Add a partial result from Smith (2024)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <button type="submit" className="editor-submit" disabled={submitting}>
            {submitting ? "Submitting…" : mode === "new" ? "Submit new problem proposal" : "Submit suggested edit"}
          </button>
          {error && <p className="comment-error">{error}</p>}
        </div>

        <div className="editor-right">
          <div className="editor-preview-page">
            {mode === "new" ? (
              <p className="muted editor-preview-id">New problem proposal</p>
            ) : (
              <p className="muted editor-preview-id">Problem #{problem!.id}</p>
            )}
            <h2 className="editor-preview-title">{name}</h2>

            <ProblemBody
              status={status}
              impact={impact}
              area={area}
              canonicalReference={{
                title: refTitle,
                author: refAuthor,
                venue: refVenue || undefined,
                year: refYear ? Number(refYear) : undefined,
                link: refLink || undefined,
                doi: refDoi || undefined,
              }}
              statementHtml={previewHtml.statement}
              definitionsHtml={previewHtml.definitions}
              partialResultsHtml={previewHtml.partialResults}
              additionalReferencesHtml={previewHtml.additionalReferences}
              notesHtml={previewHtml.notes}
              sectionHeadingTag="h3"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
