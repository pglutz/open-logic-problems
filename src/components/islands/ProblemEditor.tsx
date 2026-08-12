import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { useSigninHref } from "../../lib/signinHref";
import { renderMarkdown, renderIfPresent } from "../../lib/markdown/pipeline";
import { joinSections, splitSections, type ProblemSections } from "../../lib/markdown/sections";
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
  // Only affects the row's initial <details open> state when it's first
  // rendered — a freshly-added row starts expanded so the user can fill it
  // in immediately, while a row loaded from an existing problem starts
  // collapsed. Never updated afterward, so the user's own manual
  // expand/collapse always takes over from there.
  startOpen: boolean;
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
    startOpen: false,
  };
}

// Shared by every field label/heading that carries a parenthetical hint
// ("optional", "recommended") — a single source for that markup so the
// hint's spacing/styling can't drift out of sync across call sites.
// A single wrapping <span> (not a fragment) so this renders as one flex
// item where the parent is a flex container (e.g. the reference box's
// <summary>) — otherwise that parent's flex `gap` would apply a second,
// larger gap between the text and the hint on top of the hint's own
// margin, doubling up.
function FieldLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <span>
      {text}
      {hint && <span className="editor-label-hint">({hint})</span>}
    </span>
  );
}

// Shape stored in problem_drafts.payload — exactly the request body
// handleSubmit builds (minus the id/problemId wrapper), so a draft can be
// re-hydrated with the same logic that seeds the editor's initial state.
interface DraftPayload {
  frontmatter: {
    name: string;
    status: ProblemStatus;
    area: Area[];
    impact: 1 | 2 | 3;
    canonical_reference: CanonicalReference;
    references: Reference[];
  };
  body: string;
  commitMessage: string;
}

interface DraftListItem {
  id: string;
  name: string;
  updated_at: string;
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
      {
        localId: crypto.randomUUID(),
        key: "",
        title: "",
        author: "",
        venue: "",
        year: "",
        link: "",
        doi: "",
        startOpen: true,
      },
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

  // Drafts. Edit mode has at most one draft (per user per problem), so it's
  // tracked as a single optional row; new-problem mode allows several, shown
  // as a list. `draftId` is the row (if any) this in-progress "new" session
  // is now tied to — set once resumed or first saved — so repeat saves
  // update that row instead of piling up duplicates; it isn't needed in edit
  // mode, where every save just upserts onto the one (author, problem) row.
  const [editDraft, setEditDraft] = useState<DraftListItem | null>(null);
  const [editDraftBannerDismissed, setEditDraftBannerDismissed] = useState(false);
  const [newDrafts, setNewDrafts] = useState<DraftListItem[]>([]);
  const [newDraftsLoaded, setNewDraftsLoaded] = useState(false);
  const [newDraftsListDismissed, setNewDraftsListDismissed] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

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
  const errorSummaryRef = useRef<HTMLDivElement>(null);

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

  // Look up any saved draft(s) once signed in — RLS already restricts these
  // queries to the current user's own rows, so no author_id filter is
  // needed. Doesn't auto-load the content by default; it only surfaces a
  // resume banner/list, so a fresh page load never silently overwrites
  // what's already on disk (edit mode) or gets in the way of starting a
  // genuinely new proposal (new mode). The exception is a `?resume=` link
  // from the Account page's drafts list — that's an explicit request to load
  // a specific draft, so it's applied immediately instead of just shown as
  // an option (`?resume=1` for edit mode, since there's at most one; the
  // draft's own id for new-problem mode, since there can be several).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const autoResumeParam = new URLSearchParams(window.location.search).get("resume");
    if (mode === "edit") {
      supabase
        .from("problem_drafts")
        .select("id, name, updated_at")
        .eq("kind", "edit")
        .eq("problem_id", problem!.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data) return;
          if (autoResumeParam) {
            resumeEditDraft(data.id);
          } else {
            setEditDraft(data);
          }
        });
    } else {
      supabase
        .from("problem_drafts")
        .select("id, name, updated_at")
        .eq("kind", "new_problem")
        .order("updated_at", { ascending: false })
        .then(({ data }) => {
          if (cancelled) return;
          setNewDrafts(data ?? []);
          setNewDraftsLoaded(true);
          if (autoResumeParam && data?.some((d) => d.id === autoResumeParam)) {
            resumeNewDraft(autoResumeParam);
          }
        });
    }
    return () => {
      cancelled = true;
    };
    // problem is only present (and only relevant) in edit mode, where its id never changes across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode]);

  function applyDraftPayload(payload: DraftPayload) {
    const fm = payload.frontmatter;
    setName(fm.name);
    setStatus(fm.status);
    setArea(fm.area);
    setImpact(fm.impact);
    setRefKey(fm.canonical_reference.key ?? "");
    setRefTitle(fm.canonical_reference.title);
    setRefAuthor(fm.canonical_reference.author);
    setRefVenue(fm.canonical_reference.venue ?? "");
    setRefYear(fm.canonical_reference.year ? String(fm.canonical_reference.year) : "");
    setRefLink(fm.canonical_reference.link ?? "");
    setRefDoi(fm.canonical_reference.doi ?? "");
    setReferences(fm.references.map(referenceToRow));
    const sections = splitSections(payload.body);
    setStatement(sections.statement ?? "");
    setDefinitions(sections.definitions ?? "");
    setPartialResults(sections.partialResults ?? "");
    setClaimedProofs(sections.claimedProofs ?? "");
    setNotes(sections.notes ?? "");
    setCommitMessage(payload.commitMessage);
  }

  async function resumeEditDraft(id: string) {
    const { data } = await supabase.from("problem_drafts").select("payload").eq("id", id).single();
    if (data) applyDraftPayload(data.payload as DraftPayload);
    setEditDraftBannerDismissed(true);
  }

  async function resumeNewDraft(id: string) {
    const { data } = await supabase.from("problem_drafts").select("payload").eq("id", id).single();
    if (data) {
      applyDraftPayload(data.payload as DraftPayload);
      setDraftId(id);
    }
    setNewDraftsListDismissed(true);
  }

  // Shared with handleSubmit, so a saved draft's payload and a real
  // submission are always built from the exact same logic.
  function buildFrontmatterAndBody() {
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
    return { commonFrontmatter, bodyContent };
  }

  async function saveDraft() {
    if (!session) return;
    setSavingDraft(true);
    setDraftError(null);
    const { commonFrontmatter, bodyContent } = buildFrontmatterAndBody();
    const row = {
      author_id: session.user.id,
      kind: mode === "new" ? ("new_problem" as const) : ("edit" as const),
      problem_id: mode === "edit" ? problem!.id : null,
      name: name.trim(),
      payload: { frontmatter: commonFrontmatter, body: bodyContent, commitMessage } satisfies DraftPayload,
      updated_at: new Date().toISOString(),
    };
    const query =
      mode === "edit"
        ? supabase
            .from("problem_drafts")
            .upsert(row, { onConflict: "author_id,problem_id" })
            .select("id, name, updated_at")
            .single()
        : draftId
          ? supabase.from("problem_drafts").update(row).eq("id", draftId).select("id, name, updated_at").single()
          : supabase.from("problem_drafts").insert(row).select("id, name, updated_at").single();
    const { data, error: saveError } = await query;
    setSavingDraft(false);
    if (saveError || !data) {
      setDraftError(saveError?.message ?? "Could not save draft.");
      return;
    }
    if (mode === "edit") {
      setEditDraft(data);
      setEditDraftBannerDismissed(true);
    } else {
      setDraftId(data.id);
      setNewDrafts((prev) => [data, ...prev.filter((d) => d.id !== data.id)]);
    }
    setDraftSavedAt(data.updated_at);
  }

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
  // When the canonical reference is entirely empty, the whole box is
  // highlighted (nothing more specific to point at); when only one of
  // title/author is filled in, just that missing field is highlighted.
  const canonicalReferenceEmpty = referenceTitleBlank && referenceAuthorBlank;
  let referenceWarning: string | null = null;
  if (canonicalReferenceEmpty) {
    referenceWarning =
      "No reference has been provided. Most problems should include a reference to a reliable published source which contains a precise statement of the problem.";
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

  // "Draft saved." should only claim the *current* form state is saved —
  // clear it (and any stale save error) the moment anything actually
  // changes, rather than leaving it visible while the user keeps editing.
  // buildFrontmatterAndBody() already assembles almost exactly what a save
  // sends (only commitMessage is layered on separately in saveDraft), so
  // stringifying it plus commitMessage is a single signature covering every
  // saved field — including reference rows — without listing each one as a
  // dependency.
  const formSnapshot = JSON.stringify({ ...buildFrontmatterAndBody(), commitMessage });
  useEffect(() => {
    setDraftSavedAt(null);
    setDraftError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSnapshot]);

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

    const { commonFrontmatter, bodyContent } = buildFrontmatterAndBody();
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
    // Best-effort cleanup, not blocking the success screen on it — a
    // now-submitted draft superseded by a real PR shouldn't keep showing up
    // as "resume your draft".
    if (mode === "edit") {
      supabase.from("problem_drafts").delete().eq("kind", "edit").eq("problem_id", problem!.id);
    } else if (draftId) {
      supabase.from("problem_drafts").delete().eq("id", draftId);
    }
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
  const showValidationSummary = nameInvalid || areaInvalid || statementInvalid || commitMessageInvalid;

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
          {mode === "edit" && editDraft && !editDraftBannerDismissed && (
            <div className="editor-draft-banner" role="status">
              <span>You have a saved draft for this problem.</span>
              <span className="editor-draft-banner-actions">
                <a href="/account" className="editor-draft-banner-button">
                  See saved drafts
                </a>
                <button
                  type="button"
                  className="editor-draft-banner-button"
                  onClick={() => setEditDraftBannerDismissed(true)}
                >
                  Dismiss
                </button>
              </span>
            </div>
          )}

          {mode === "new" && newDraftsLoaded && newDrafts.length > 0 && !newDraftsListDismissed && !draftId && (
            <div className="editor-draft-banner" role="status">
              <span>
                You have {newDrafts.length} saved new problem draft{newDrafts.length > 1 ? "s" : ""}.
              </span>
              <span className="editor-draft-banner-actions">
                <a href="/account" className="editor-draft-banner-button">
                  See saved drafts
                </a>
                <button
                  type="button"
                  className="editor-draft-banner-button"
                  onClick={() => setNewDraftsListDismissed(true)}
                >
                  Dismiss
                </button>
              </span>
            </div>
          )}

          {(showValidationSummary ||
            hasReferenceKeyErrors ||
            statusWarning ||
            referenceWarning ||
            additionalReferenceWarning) && (
            <div className="editor-messages" id="editor-error-summary" ref={errorSummaryRef} tabIndex={-1}>
              {showValidationSummary && (
                <p className="editor-error-box" role="alert">
                  <strong>Error:</strong> One or more required fields are blank.
                </p>
              )}
              {hasReferenceKeyErrors && (
                <p className="editor-error-box" role="alert">
                  <strong>Error:</strong> One or more reference keys are missing, invalid, or duplicated.
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

          <div className="editor-top-box">
            <div className="editor-header-fields">
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
                placeholder="A precise statement of the problem. *Markdown* and $\LaTeX$ are supported."
              />
            </div>

            <details
              className={`editor-collapsible editor-reference-box${canonicalReferenceEmpty ? " editor-collapsible-warning" : ""}`}
            >
              <summary>
                <FieldLabel text="Reference for the problem statement" hint="recommended" />
              </summary>
              <div className="editor-collapsible-body">
                <div className="editor-reference-row-header">
                  <div className={`editor-field${canonicalKeyInvalid ? " editor-field-invalid" : ""}`}>
                    <label htmlFor="editor-ref-key">Citation key</label>
                    <input
                      id="editor-ref-key"
                      type="text"
                      maxLength={200}
                      placeholder="e.g. Smi20"
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
                <div
                  className={`editor-field${referenceTitleBlank && !canonicalReferenceEmpty ? " editor-field-warning" : ""}`}
                >
                  <label htmlFor="editor-ref-title">Title</label>
                  <input
                    id="editor-ref-title"
                    type="text"
                    maxLength={500}
                    value={refTitle}
                    onChange={(e) => setRefTitle(e.target.value)}
                  />
                </div>
                <div
                  className={`editor-field${referenceAuthorBlank && !canonicalReferenceEmpty ? " editor-field-warning" : ""}`}
                >
                  <label htmlFor="editor-ref-author">Author(s)</label>
                  <input
                    id="editor-ref-author"
                    type="text"
                    maxLength={500}
                    value={refAuthor}
                    onChange={(e) => setRefAuthor(e.target.value)}
                  />
                </div>
                <div className="editor-field">
                  <label htmlFor="editor-ref-venue">
                    <FieldLabel text="Venue" hint="optional" />
                  </label>
                  <input
                    id="editor-ref-venue"
                    type="text"
                    maxLength={500}
                    value={refVenue}
                    onChange={(e) => setRefVenue(e.target.value)}
                  />
                </div>
                <div className="editor-field">
                  <label htmlFor="editor-ref-year">
                    <FieldLabel text="Year" hint="optional" />
                  </label>
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
                  <label htmlFor="editor-ref-link">
                    <FieldLabel text="Link" hint="optional" />
                  </label>
                  <input
                    id="editor-ref-link"
                    type="url"
                    maxLength={500}
                    value={refLink}
                    onChange={(e) => setRefLink(e.target.value)}
                  />
                </div>
                <div className="editor-field">
                  <label htmlFor="editor-ref-doi">
                    <FieldLabel text="DOI" hint="optional" />
                  </label>
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
          </div>

          <div className="editor-field">
            <label htmlFor="editor-definitions">
              <FieldLabel text="Definitions" hint="optional" />
            </label>
            <textarea
              id="editor-definitions"
              value={definitions}
              onChange={(e) => setDefinitions(e.target.value)}
              rows={5}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-partial-results">
              <FieldLabel text="Known Partial Results" hint="optional" />
            </label>
            <textarea
              id="editor-partial-results"
              value={partialResults}
              onChange={(e) => setPartialResults(e.target.value)}
              rows={5}
              placeholder="e.g. This was proven in the finite case by [^Smi20]."
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-claimed-proofs">
              <FieldLabel text="Claimed Proofs" hint="optional" />
            </label>
            <textarea
              id="editor-claimed-proofs"
              value={claimedProofs}
              onChange={(e) => setClaimedProofs(e.target.value)}
              rows={5}
            />
          </div>
          <div className="editor-field">
            <label htmlFor="editor-notes">
              <FieldLabel text="Notes" hint="optional" />
            </label>
            <textarea
              id="editor-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="editor-field">
            <label>
              <FieldLabel text="Additional References" hint="optional" />
            </label>
            <div className="editor-reference-list">
              {references.map((row) => {
                const rowInvalid = rowKeyProblem(row);
                const rowBlank = isRowBlank(row);
                const rowTitleBlank = !rowBlank && !row.title.trim();
                const rowAuthorBlank = !rowBlank && !row.author.trim();
                const summaryLabel =
                  row.title.trim() || (row.key.trim() ? `[${row.key.trim()}]` : "New reference");
                return (
                  <details
                    key={row.localId}
                    className="editor-collapsible editor-reference-box"
                    open={row.startOpen || undefined}
                  >
                    <summary>
                      <span className="editor-reference-summary-row">
                        <span className="editor-reference-summary-title">{summaryLabel}</span>
                        <button
                          type="button"
                          className="editor-reference-remove"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeReferenceRow(row.localId);
                          }}
                        >
                          Remove reference
                        </button>
                      </span>
                    </summary>
                    <div className="editor-collapsible-body">
                      <div className="editor-reference-row-header">
                        <div className={`editor-field${rowInvalid ? " editor-field-invalid" : ""}`}>
                          <label htmlFor={`editor-ref-key-${row.localId}`}>Citation key</label>
                          <input
                            id={`editor-ref-key-${row.localId}`}
                            type="text"
                            maxLength={200}
                            placeholder="e.g. Smi20"
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
                        </div>
                      </div>
                      <div className={`editor-field${rowTitleBlank ? " editor-field-warning" : ""}`}>
                        <label htmlFor={`editor-ref-title-${row.localId}`}>Title</label>
                        <input
                          id={`editor-ref-title-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.title}
                          onChange={(e) => updateReferenceRow(row.localId, { title: e.target.value })}
                        />
                      </div>
                      <div className={`editor-field${rowAuthorBlank ? " editor-field-warning" : ""}`}>
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
                        <label htmlFor={`editor-ref-venue-${row.localId}`}>
                          <FieldLabel text="Venue" hint="optional" />
                        </label>
                        <input
                          id={`editor-ref-venue-${row.localId}`}
                          type="text"
                          maxLength={500}
                          value={row.venue}
                          onChange={(e) => updateReferenceRow(row.localId, { venue: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-year-${row.localId}`}>
                          <FieldLabel text="Year" hint="optional" />
                        </label>
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
                        <label htmlFor={`editor-ref-link-${row.localId}`}>
                          <FieldLabel text="Link" hint="optional" />
                        </label>
                        <input
                          id={`editor-ref-link-${row.localId}`}
                          type="url"
                          maxLength={500}
                          value={row.link}
                          onChange={(e) => updateReferenceRow(row.localId, { link: e.target.value })}
                        />
                      </div>
                      <div className="editor-field">
                        <label htmlFor={`editor-ref-doi-${row.localId}`}>
                          <FieldLabel text="DOI" hint="optional" />
                        </label>
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

          <div className="editor-submit-group">
            <div className="editor-actions">
              <button type="button" className="editor-save-draft" onClick={saveDraft} disabled={savingDraft}>
                {savingDraft ? "Saving…" : "Save draft"}
              </button>
              <button type="submit" className="editor-submit" disabled={submitting}>
                {submitting
                  ? "Submitting…"
                  : mode === "new"
                    ? "Submit new problem proposal"
                    : "Submit suggested edit"}
              </button>
            </div>
            {draftSavedAt && !draftError && (
              <p className="muted" aria-live="polite">
                Draft saved.
              </p>
            )}
            {draftError && <p className="comment-error">{draftError}</p>}
            {error && <p className="comment-error">{error}</p>}
          </div>
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
