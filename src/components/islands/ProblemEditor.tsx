import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { OPEN_AUTH_POPOVER_EVENT } from "../../lib/authPopoverEvent";
import { renderMarkdown } from "../../lib/markdown/pipeline";
import { AREAS, type Area } from "../../lib/areas";
import { STATUS_LABELS, IMPACT_RUBRIC, type ProblemStatus } from "../../lib/problems";
import { formatArea } from "../../lib/problems";

interface CanonicalReference {
  title: string;
  author: string;
  venue?: string;
  year?: number;
  link?: string;
}

interface ProblemEditorProps {
  problem: {
    id: number;
    name?: string;
    status: ProblemStatus;
    area: Area[];
    impact: 1 | 2 | 3;
    canonicalReference: CanonicalReference;
  };
  rawBody: string;
}

export default function ProblemEditor({ problem, rawBody }: ProblemEditorProps) {
  const [session, setSession] = useState<Session | null>(null);

  const [name, setName] = useState(problem.name ?? "");
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

  const [body, setBody] = useState(rawBody);
  const [previewHtml, setPreviewHtml] = useState("");
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
      renderMarkdown(body).then(setPreviewHtml);
    }, 250);
    return () => clearTimeout(timer);
  }, [body]);

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
          name: name || undefined,
          status,
          area,
          impact,
          canonical_reference: {
            title: refTitle,
            author: refAuthor,
            venue: refVenue || undefined,
            year: refYear ? Number(refYear) : undefined,
            link: refLink || undefined,
          },
        },
        body,
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

  return (
    <form className="problem-editor" onSubmit={handleSubmit}>
      <div className="editor-field">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="editor-field">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as ProblemStatus)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {status !== problem.status && (
          <p className="editor-status-warning">
            You're changing this problem's status — status changes get extra scrutiny during
            review, so please make sure this is backed by a citable published result.
          </p>
        )}
      </div>

      <div className="editor-field">
        <label>Area</label>
        <div className="editor-area-checkboxes">
          {AREAS.map((a) => (
            <label key={a} className="editor-checkbox-label">
              <input type="checkbox" checked={area.includes(a)} onChange={() => toggleArea(a)} />
              {formatArea(a)}
            </label>
          ))}
        </div>
      </div>

      <div className="editor-field">
        <label>Impact</label>
        <select value={impact} onChange={(e) => setImpact(Number(e.target.value) as 1 | 2 | 3)}>
          {([1, 2, 3] as const).map((n) => (
            <option key={n} value={n}>
              {IMPACT_RUBRIC[n]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="editor-fieldset">
        <legend>Canonical reference</legend>
        <div className="editor-field">
          <label>Title</label>
          <input type="text" required value={refTitle} onChange={(e) => setRefTitle(e.target.value)} />
        </div>
        <div className="editor-field">
          <label>Author</label>
          <input type="text" required value={refAuthor} onChange={(e) => setRefAuthor(e.target.value)} />
        </div>
        <div className="editor-field">
          <label>Venue</label>
          <input type="text" value={refVenue} onChange={(e) => setRefVenue(e.target.value)} />
        </div>
        <div className="editor-field">
          <label>Year</label>
          <input type="number" value={refYear} onChange={(e) => setRefYear(e.target.value)} />
        </div>
        <div className="editor-field">
          <label>Link</label>
          <input type="url" value={refLink} onChange={(e) => setRefLink(e.target.value)} />
        </div>
      </fieldset>

      <div className="editor-panes">
        <div className="editor-pane">
          <label>Markdown</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} />
        </div>
        <div className="editor-pane">
          <label>Preview</label>
          <div className="editor-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>

      <div className="editor-field">
        <label>Summary of changes</label>
        <input
          type="text"
          required
          placeholder="e.g. Add a partial result from Smith (2024)"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit suggested edit"}
      </button>
      {error && <p className="comment-error">{error}</p>}
    </form>
  );
}
