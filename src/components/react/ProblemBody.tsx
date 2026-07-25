import StatusBadge from "./StatusBadge";
import ImpactMarks from "./ImpactMarks";
import AreaTags from "./AreaTags";
import type { ProblemStatus } from "../../lib/problems";

interface CanonicalReference {
  title: string;
  author: string;
  venue?: string;
  year?: number;
  link?: string;
  doi?: string;
}

interface ProblemBodyProps {
  status: ProblemStatus;
  impact: 1 | 2 | 3;
  area: string[];
  canonicalReference: CanonicalReference;
  statementHtml: string;
  definitionsHtml?: string;
  partialResultsHtml?: string;
  additionalReferencesHtml?: string;
  notesHtml?: string;
  // Omitted entirely in the suggest-an-edit live preview, where a link back
  // to the edit page it's already inside of wouldn't make sense.
  suggestEditHref?: string;
  // The real problem page uses <h1> for the problem name, so section
  // headings are <h2>. The live preview nests inside a page that already
  // has its own <h1>, so its title is an <h2> and section headings need to
  // drop to <h3> to keep a sane document outline.
  sectionHeadingTag?: "h2" | "h3";
}

// Single source of truth for the "problem body" markup — used both by the
// real problem page (statically rendered, no client JS) and by the
// suggest-an-edit live preview (a hydrated island), so the preview can't
// silently drift out of sync with the real page the way two hand-maintained
// copies did before.
export default function ProblemBody({
  status,
  impact,
  area,
  canonicalReference,
  statementHtml,
  definitionsHtml,
  partialResultsHtml,
  additionalReferencesHtml,
  notesHtml,
  suggestEditHref,
  sectionHeadingTag = "h2",
}: ProblemBodyProps) {
  const SectionHeading = sectionHeadingTag;

  return (
    <>
      <div className={`status-box statement-box status-${status}`}>
        <div className="meta-row">
          <StatusBadge status={status} />
          <ImpactMarks impact={impact} />
        </div>
        <div className="statement-body" dangerouslySetInnerHTML={{ __html: statementHtml }} />
        <div className="area-row">
          <AreaTags areas={area} />
          {suggestEditHref && (
            <a className="suggest-edit-link" href={suggestEditHref}>
              Suggest an edit
            </a>
          )}
        </div>
      </div>

      <section className="problem-section">
        <SectionHeading className="section-heading">Reference for the problem statement</SectionHeading>
        <p>
          {canonicalReference.author}, <em>{canonicalReference.title}</em>
          {canonicalReference.venue && <>, {canonicalReference.venue}</>}
          {canonicalReference.year && <>, {canonicalReference.year}</>}
          {canonicalReference.link && (
            <>
              {" "}
              (<a href={canonicalReference.link}>link</a>)
            </>
          )}
          {canonicalReference.doi && (
            <>
              {" "}
              (DOI:{" "}
              <a href={`https://doi.org/${canonicalReference.doi}`}>{canonicalReference.doi}</a>)
            </>
          )}
        </p>
      </section>

      {definitionsHtml && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Definitions</SectionHeading>
          <div dangerouslySetInnerHTML={{ __html: definitionsHtml }} />
        </section>
      )}

      {partialResultsHtml && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Known Partial Results</SectionHeading>
          <div dangerouslySetInnerHTML={{ __html: partialResultsHtml }} />
        </section>
      )}

      {notesHtml && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Notes</SectionHeading>
          <div dangerouslySetInnerHTML={{ __html: notesHtml }} />
        </section>
      )}

      {additionalReferencesHtml && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Additional References</SectionHeading>
          <div dangerouslySetInnerHTML={{ __html: additionalReferencesHtml }} />
        </section>
      )}
    </>
  );
}
