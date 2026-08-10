import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { useSigninHref } from "../../lib/signinHref";
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
import type { CanonicalReference, Reference } from "../../lib/problemSchema";

// Every field is required here (unlike ProblemSections, where they're
// optional) — the editor always seeds its textareas with a definite string,
// using "" rather than undefined for an absent section.
type ProblemSectionsInput = Required<ProblemSections>;

const EMPTY_SECTIONS: ProblemSectionsInput = {
  statement: "",
  definitions: "",
  partialResults: "",
  claimedProofs: "",
  notes: "",
};

// Local, editor-only shape for an in-progress additional-reference row.
// `localId` is a stable React list key generated once per row — the
// user-facing `key` field can be blank or transiently duplicated while
// editing, so it can't double as the React key itself. `year` stays a string
// (like the canonical reference's own `refYear` state) since it's bound to a
// text input.
interface ReferenceRow {
  localId: string;
  key: string;
  title: string;
  author: string;
  venue: string;
  year: string;
  link: string;
  doi: string;
}

function referenceToRow(ref: Reference): ReferenceRow {
  return {
    localId: crypto.randomUUID(),
    key: ref.key,
    title: ref.title,
    author: ref.author,
    venue: ref.venue ?? "",
    year: ref.year ? String(ref.year) : "",
    link: ref.link ?? "",
    doi: ref.doi ?? "",
  };
}

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
    references: Reference[];
  };
  sections?: ProblemSectionsInput;
}

interface PreviewHtml {
  statement: string;
  definitions?: string;
  partialResults?: string;
  claimedProofs?: string;
  notes?: string;
}

export default function ProblemEditor({ mode = "edit", problem, sections }: ProblemEditorProps) {
  const [session, setSession] = useState<Session | null>(null);
  const signinHref = useSigninHref();

  // A brand-new proposal has no prior on-disk status to compare against —
  // treat "open" as the baseline instead, so the existing status-warning
  // condition below (`status !== baselineStatus`) needs no new branching.
  const baselineStatus: ProblemStatus = mode === "new" ? "open" : problem!.status;
  const initialSections = sections ?? EMPTY_SECTIONS;

  const [name, setName] = useState(problem?.name ?? "");
  const [status, setStatus] = useState<ProblemStatus>(baselineStatus);
  const [area, setArea] = useState<Area[]>(problem?.area ?? []);
  const [impact, setImpact] = useState<1 | 2 | 3>(problem?.impact ?? 1);
  const [refKey, setRefKey] = useState(problem?.canonicalReference.key ?? "");
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
  const [claimedProofs, setClaimedProofs] = useState(initialSections.claimedProofs);
  const [notes, setNotes] = useState(initialSections.notes);

  const [references, setReferences] = useState<ReferenceRow[]>(() =>
    (problem?.references ?? []).map(referenceToRow),
  );
  function addReferenceRow() {
    setReferences((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), key: "", title: "", author: "", venue: "", year: "", link: "", doi: "" },
    ]);
  }
  function removeReferenceRow(localId: string) {
    setReferences((prev) => prev.filter((r) => r.localId !== localId));
  }
  function updateReferenceRow(localId: string, patch: Partial<ReferenceRow>) {
    setReferences((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  const [previewHtml, setPreviewHtml] = useState<PreviewHtml>({ statement: "" });
  const [commitMessage, setCommitMessage] = useState("");

  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ prUrl: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyCitation(key: string, id: string) {
    if (!key.trim()) return;
    navigator.clipboard.writeText(`[^${key.trim()}]`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  }

  // Which required fields were blank *at the last submit attempt* — a
  // snapshot, not a live computation, so blanking a field out after a failed
  // submit doesn't newly highlight it until the user tries submitting again.
  // A field already in this set still stops being highlighted the moment
  // it's filled in, since the render below ANDs this with the field's
  // current (live) blank-ness. Reference-key problems are the one exception
  // — see canonicalKeyInvalid/rowKeyProblem below, which highlight live.
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (invalidFields.size > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [invalidFields]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const validKeys = new Set(
    [refKey, ...references.map((r) => r.key)].map((k) => k.trim()).filter(Boolean),
  );
  const validKeysSignature = [...validKeys].sort().join(",");

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([
        renderMarkdown(statement, validKeys),
        renderIfPresent(definitions, validKeys),
        renderIfPresent(partialResults, validKeys),
        renderIfPresent(claimedProofs, validKeys),
        renderIfPresent(notes, validKeys),
      ]).then(([statementHtml, definitionsHtml, partialResultsHtml, claimedProofsHtml, notesHtml]) => {
        setPreviewHtml({
          statement: statementHtml,
          definitions: definitionsHtml,
          partialResults: partialResultsHtml,
          claimedProofs: claimedProofsHtml,
          notes: notesHtml,
        });
      });
    }, 250);
    return () => clearTimeout(timer);
    // validKeysSignature stands in for validKeys, which is a new Set every render.
  }, [statement, definitions, partialResults, claimedProofs, notes, validKeysSignature]);

  function toggleArea(a: Area) {
    setArea((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  const missingName = !name.trim();
  const missingArea = area.length === 0;
  const missingStatement = !statement.trim();
  const missingCommitMessage = mode === "edit" && !commitMessage.trim();

  const KEY_FORMAT_RE = /^[A-Za-z0-9-]+$/;
  const isRowBlank = (row: ReferenceRow) =>
    !row.key.trim() &&
    !row.title.trim() &&
    !row.author.trim() &&
    !row.venue.trim() &&
    !row.year.trim() &&
    !row.link.trim() &&
    !row.doi.trim();
  const nonBlankRows = references.filter((r) => !isRowBlank(r));

  // A key is required as soon as there's a reference to cite: unconditionally
  // for every non-blank additional-reference row, and only conditionally for
  // the canonical reference, which can still legitimately be left fully blank.
  const missingCanonicalKey = !refKey.trim() && (!!refTitle.trim() || !!refAuthor.trim());
  const canonicalKeyFormatInvalid = !!refKey.trim() && !KEY_FORMAT_RE.test(refKey.trim());
  const rowsMissingKey = nonBlankRows.filter((r) => !r.key.trim());
  const rowsWithBadKeyFormat = references.filter((r) => r.key.trim() && !KEY_FORMAT_RE.test(r.key.trim()));

  const keyCounts = new Map<string, number>();
  const trimmedCanonicalKey = refKey.trim();
  if (trimmedCanonicalKey) keyCounts.set(trimmedCanonicalKey, (keyCounts.get(trimmedCanonicalKey) ?? 0) + 1);
  for (const r of references) {
    const k = r.key.trim();
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
  const duplicateKeys = new Set([...keyCounts.entries()].filter(([, count]) => count > 1).map(([k]) => k));

  const canonicalKeyProblem =
    missingCanonicalKey || canonicalKeyFormatInvalid || (!!trimmedCanonicalKey && duplicateKeys.has(trimmedCanonicalKey));
  const rowKeyProblem = (row: ReferenceRow) => {
    const k = row.key.trim();
    return rowsMissingKey.includes(row) || rowsWithBadKeyFormat.includes(row) || (!!k && duplicateKeys.has(k));
  };

  const hasReferenceKeyErrors =
    missingCanonicalKey ||
    canonicalKeyFormatInvalid ||
    rowsMissingKey.length > 0 ||
    rowsWithBadKeyFormat.length > 0 ||
    duplicateKeys.size > 0;

  const hasValidationErrors =
    missingName || missingArea || missingStatement || missingCommitMessage || hasReferenceKeyErrors;

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

  const rowsMissingTitleOrAuthor = nonBlankRows.filter((r) => !r.title.trim() || !r.author.trim());
  const additionalReferenceWarning =
    rowsMissingTitleOrAuthor.length === 0
      ? null
      : rowsMissingTitleOrAuthor.length === 1
        ? "One additional reference is missing a title or author."
        : `${rowsMissingTitleOrAuthor.length} additional references are missing a title or author.`;

  const statusChanged = status !== baselineStatus;
  const statusWarning = statusChanged
    ? mode === "new"
      ? "New problems with non-open status will receive extra scrutiny during review; please make sure the status is correct and that the prbolem is worthy of inclusion."
      : "You're changing this problem's status — status changes will receive extra scrutiny during review, so please make sure the status change is correct and is backed by reliable evidence."
    : null;

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    if (hasValidationErrors) {
      const missing = new Set<string>();
      if (missingName) missing.add("name");
      if (missingArea) missing.add("area");
      if (missingStatement) missing.add("statement");
      if (missingCommitMessage) missing.add("commitMessage");
      if (canonicalKeyProblem) missing.add("canonicalReferenceKey");
      for (const row of references) {
        if (rowKeyProblem(row)) missing.add(`referenceKey-${row.localId}`);
      }
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
        key: refKey.trim() || undefined,
        title: refTitle,
        author: refAuthor,
        venue: refVenue || undefined,
        year: refYear ? Number(refYear) : undefined,
        link: refLink || undefined,
        doi: refDoi || undefined,
      },
      references: nonBlankRows.map((r) => ({
        key: r.key.trim(),
        title: r.title,
        author: r.author,
        venue: r.venue || undefined,
        year: r.year ? Number(r.year) : undefined,
        link: r.link || undefined,
        doi: r.doi || undefined,
      })),
    };
    const bodyContent = joinSections({
      statement,
      definitions,
      partialResults,
      claimedProofs,
      notes,
    });
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
        <a href={signinHref}>Sign in</a> to {mode === "new" ? "propose a new problem" : "suggest an edit"}.
      </p>
    );
  }

  if (result) {
    return (
      <p className="comment-signin-prompt">
        Your {mode === "new" ? "problem proposal" : "suggested edit"} has been submitted as a pull
        request on github:{" "}
        <a href={result.prUrl} target="_blank" rel="noreferrer">
          {result.prUrl}
        </a>
        <br />
        <br />
        You'll get another email when it's accepted.
      </p>
    );
  }

  const nameInvalid = invalidFields.has("name") && missingName;
  const areaInvalid = invalidFields.has("area") && missingArea;
  const statementInvalid = invalidFields.has("statement") && missingStatement;
  const commitMessageInvalid = invalidFields.has("commitMessage") && missingCommitMessage;
  // Unlike the other required-field highlights above (gated to "since the
  // last submit attempt"), reference-key problems highlight live — they're
  // cheap to check and catching a duplicate/malformed key immediately is
  // more useful than waiting for a failed submit.
  const canonicalKeyInvalid = canonicalKeyProblem;
  const showValidationSummary =
    nameInvalid ||
    areaInvalid ||
    statementInvalid ||
    commitMessageInvalid ||
    (invalidFields.has("canonicalReferenceKey") && canonicalKeyProblem) ||
    references.some((r) => invalidFields.has(`referenceKey-${r.localId}`) && rowKeyProblem(r));

  return (
    <form className="problem-editor" onSubmit={handleSubmit} noValidate>
      <div className="editor-columns" data-mobile-tab={mobileTab}>
        <div className="editor-mobile-tabs" data-active={mobileTab} role="tablist">
          <div className="editor-mobile-tab-slider" aria-hidden="true" />
          <button
            type="button"
            id="editor-tab-edit"
            role="tab"
            aria-selected={mobileTab === "edit"}
            aria-controls="editor-panel-edit"
            className={`editor-mobile-tab${mobileTab === "edit" ? " editor-mobile-tab-active" : ""}`}
            onClick={() => setMobileTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            id="editor-tab-preview"
            role="tab"
            aria-selected={mobileTab === "preview"}
            aria-controls="editor-panel-preview"
            className={`editor-mobile-tab${mobileTab === "preview" ? " editor-mobile-tab-active" : ""}`}
            onClick={() => setMobileTab("preview")}
          >
            Preview
          </button>
        </div>
        <div className="editor-left" id="editor-panel-edit" role="tabpanel" aria-labelledby="editor-tab-edit">
          <div className="editor-header-fields">
            {(showValidationSummary || statusWarning || referenceWarning || additionalReferenceWarning) && (
              <div className="editor-messages">
                {showValidationSummary && (
                  <p
                    id="editor-error-summary"
                    className="editor-error-box"
                    role="alert"
                    tabIndex={-1}
                    ref={errorSummaryRef}
                  >
                    <strong>Error:</strong> One or more required fields are blank, or a reference key is
                    missing, invalid, or duplicated.
                  </p>
                )}
                {statusWarning && (
                  <p className="editor-warning-box" role="status">
                    <strong>Warning:</strong> {statusWarning}
                  </p>
                )}
                {referenceWarning && (
                  <p className="editor-warning-box" role="status">
                    <strong>Warning:</strong> {referenceWarning}
                  </p>
                )}
                {additionalReferenceWarning && (
                  <p className="editor-warning-box" role="status">
                    <strong>Warning:</strong> {additionalReferenceWarning}
                  </p>
                )}
              </div>
            )}
            <div className={`editor-field editor-field-full-width${nameInvalid ? " editor-field-invalid" : ""}`}>
              <label htmlFor="editor-name">Title</label>
              <input
                id="editor-name"
                type="text"
                maxLength={500}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={nameInvalid || undefined}
                aria-describedby={nameInvalid ? "editor-error-summary" : undefined}
              />
            </div>

            <details
              className={`editor-collapsible${areaInvalid ? " editor-collapsible-invalid" : ""}`}
              aria-describedby={areaInvalid ? "editor-error-summary" : undefined}
            >
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
              <div className={`editor-field editor-field-compact${statusChanged ? " editor-field-warning" : ""}`}>
                <label htmlFor="editor-status">Status</label>
                <select
                  id="editor-status"
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
                <label htmlFor="editor-impact">Impact</label>
                <select
                  id="editor-impact"
                  className="editor-select-compact"
                  title={IMPACT_RUBRIC[impact]}
                  value={impact}
                  onChange={(e) => setImpact(Number(e.target.value) as 1 | 2 | 3)}
                >
                  {([3, 2, 1] as const).map((n) => (
                    <option key={n} value={n} title={IMPACT_RUBRIC[n]}>
                      {IMPACT_LABELS[n]}
                      {"  "}
                      {IMPACT_SHORT_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={`editor-field${statementInvalid ? " editor-field-invalid" : ""}`}>
            <label htmlFor="editor-statement">Statement</label>
            <textarea
              id="editor-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={8}
              aria-invalid={statementInvalid || undefined}
              aria-describedby={statementInvalid ? "editor-error-summary" : undefined}
            />
          </div>

          <div className="editor-field">
            <label htmlFor="editor-definitions">Definitions (optional)</label>
            <textarea
              id="editor-definitions"
              value={definitions}
              onChange={(e) => setDefinitions(e.target.value)}
              rows={5}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-partial-results">Known Partial Results (optional)</label>
            <textarea
              id="editor-partial-results"
              value={partialResults}
              onChange={(e) => setPartialResults(e.target.value)}
              rows={5}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-claimed-proofs">Claimed Proofs (optional)</label>
            <textarea
              id="editor-claimed-proofs"
              value={claimedProofs}
              onChange={(e) => setClaimedProofs(e.target.value)}
              rows={5}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-notes">Notes (optional)</label>
            <textarea
              id="editor-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g. This was first noted in [^smith2020]."
            />
          </div>

          <details
            className={`editor-collapsible${referenceWarning || canonicalKeyInvalid ? (canonicalKeyInvalid ? " editor-collapsible-invalid" : " editor-collapsible-warning") : ""}`}
          >
            <summary>Reference for the problem statement</summary>
            <div className="editor-collapsible-body">
              <div className="editor-reference-row-header">
                <div className={`editor-field${canonicalKeyInvalid ? " editor-field-invalid" : ""}`}>
                  <label htmlFor="editor-ref-key">Key</label>
                  <input
                    id="editor-ref-key"
                    type="text"
                    maxLength={200}
                    placeholder="e.g. smith2020"
                    value={refKey}
                    onChange={(e) => setRefKey(e.target.value)}
                    aria-invalid={canonicalKeyInvalid || undefined}
                    aria-describedby={canonicalKeyInvalid ? "editor-error-summary" : undefined}
                  />
                </div>
                <div className="editor-reference-row-actions">
                  <button
                    type="button"
                    className="link-button editor-copy-citation"
                    disabled={!refKey.trim()}
                    onClick={() => copyCitation(refKey, "canonical")}
                  >
                    {copiedId === "canonical" ? "Copied!" : "Copy citation"}
                  </button>
                </div>
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-title">Title (optional)</label>
                <input
                  id="editor-ref-title"
                  type="text"
                  maxLength={500}
                  value={refTitle}
                  onChange={(e) => setRefTitle(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-author">Author(s) (optional)</label>
                <input
                  id="editor-ref-author"
                  type="text"
                  maxLength={500}
                  value={refAuthor}
                  onChange={(e) => setRefAuthor(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-venue">Venue (optional)</label>
                <input
                  id="editor-ref-venue"
                  type="text"
                  maxLength={500}
                  value={refVenue}
                  onChange={(e) => setRefVenue(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-year">Year (optional)</label>
                <input
                  id="editor-ref-year"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear() + 1}
                  value={refYear}
                  onChange={(e) => setRefYear(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-link">Link (optional)</label>
                <input
                  id="editor-ref-link"
                  type="url"
                  maxLength={500}
                  value={refLink}
                  onChange={(e) => setRefLink(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="editor-ref-doi">DOI (optional)</label>
                <input
                  id="editor-ref-doi"
                  type="text"
                  maxLength={500}
                  value={refDoi}
                  onChange={(e) => setRefDoi(e.target.value)}
                />
              </div>
            </div>
          </details>

          <div className="editor-field">
            <label>Additional References (optional)</label>
            <div className="editor-reference-list">
              {references.map((row) => {
                const rowInvalid = rowKeyProblem(row);
                const summaryLabel =
                  row.title.trim() || (row.key.trim() ? `[${row.key.trim()}]` : "New reference");
                return (
                  <details
                    key={row.localId}
                    className={`editor-collapsible${rowInvalid ? " editor-collapsible-invalid" : ""}`}
                  >
                    <summary>{summaryLabel}</summary>
                    <div className="editor-collapsible-body">
                      <div className="editor-reference-row-header">
                        <div className={`editor-field${rowInvalid ? " editor-field-invalid" : ""}`}>
                          <label htmlFor={`editor-ref-key-${row.localId}`}>Key</label>
                          <input
                            id={`editor-ref-key-${row.localId}`}
                            type="text"
                            maxLength={200}
                            placeholder="e.g. smith2020"
                            value={row.key}
                            onChange={(e) => updateReferenceRow(row.localId, { key: e.target.value })}
                            aria-invalid={rowInvalid || undefined}
                            aria-describedby={rowInvalid ? "editor-error-summary" : undefined}
                          />
                        </div>
                        <div className="editor-reference-row-actions">
                          <button
                            type="button"
                            className="link-button editor-copy-citation"
                            disabled={!row.key.trim()}
                            onClick={() => copyCitation(row.key, row.localId)}
                          >
                            {copiedId === row.localId ? "Copied!" : "Copy citation"}
                          </button>
                          <button
                            type="button"
                            className="link-button editor-reference-remove"
                            onClick={() => removeReferenceRow(row.localId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-title-${row.localId}`}>Title</label>
                        <input
                          id={`editor-ref-title-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.title}
                          onChange={(e) => updateReferenceRow(row.localId, { title: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-author-${row.localId}`}>Author(s)</label>
                        <input
                          id={`editor-ref-author-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.author}
                          onChange={(e) => updateReferenceRow(row.localId, { author: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-venue-${row.localId}`}>Venue (optional)</label>
                        <input
                          id={`editor-ref-venue-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.venue}
                          onChange={(e) => updateReferenceRow(row.localId, { venue: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-year-${row.localId}`}>Year (optional)</label>
                        <input
                          id={`editor-ref-year-${row.localId}`}
                          type="number"
                          min={1800}
                          max={new Date().getFullYear() + 1}
                          value={row.year}
                          onChange={(e) => updateReferenceRow(row.localId, { year: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-link-${row.localId}`}>Link (optional)</label>
                        <input
                          id={`editor-ref-link-${row.localId}`}
                          type="url"
                          maxLength={500}
                          value={row.link}
                          onChange={(e) => updateReferenceRow(row.localId, { link: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-doi-${row.localId}`}>DOI (optional)</label>
                        <input
                          id={`editor-ref-doi-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.doi}
                          onChange={(e) => updateReferenceRow(row.localId, { doi: e.target.value })}
                        />
                      </div>
                    </div>
                  </details>
                );
              })}
              <button type="button" className="editor-add-reference" onClick={addReferenceRow}>
                + Add reference
              </button>
            </div>
          </div>

          {mode === "edit" && (
            <div className={`editor-field${commitMessageInvalid ? " editor-field-invalid" : ""}`}>
              <label htmlFor="editor-commit-message-field">Summary of changes</label>
              <textarea
                id="editor-commit-message-field"
                className="editor-commit-message"
                placeholder="e.g. Add a partial result from Smith (2024)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
                aria-invalid={commitMessageInvalid || undefined}
                aria-describedby={commitMessageInvalid ? "editor-error-summary" : undefined}
              />
            </div>
          )}

          <button type="submit" className="editor-submit" disabled={submitting}>
            {submitting ? "Submitting…" : mode === "new" ? "Submit new problem proposal" : "Submit suggested edit"}
          </button>
          {error && <p className="comment-error">{error}</p>}
        </div>

        <div
          className="editor-right"
          id="editor-panel-preview"
          role="tabpanel"
          aria-labelledby="editor-tab-preview"
        >
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
                key: refKey || undefined,
                title: refTitle,
                author: refAuthor,
                venue: refVenue || undefined,
                year: refYear ? Number(refYear) : undefined,
                link: refLink || undefined,
                doi: refDoi || undefined,
              }}
              references={nonBlankRows.map((r) => ({
                key: r.key,
                title: r.title,
                author: r.author,
                venue: r.venue || undefined,
                year: r.year ? Number(r.year) : undefined,
                link: r.link || undefined,
                doi: r.doi || undefined,
              }))}
              statementHtml={previewHtml.statement}
              definitionsHtml={previewHtml.definitions}
              partialResultsHtml={previewHtml.partialResults}
              claimedProofsHtml={previewHtml.claimedProofs}
              notesHtml={previewHtml.notes}
              sectionHeadingTag="h3"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
