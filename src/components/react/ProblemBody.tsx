import StatusBadge from "./StatusBadge";
import ImpactMarks from "./ImpactMarks";
import AreaTags from "./AreaTags";
import type { ProblemStatus } from "../../lib/problems";
import type { CanonicalReference } from "../../lib/problemSchema";

interface ProblemBodyProps {
  status: ProblemStatus;
  impact: 1 | 2 | 3;
  area: string[];
  canonicalReference: CanonicalReference;
  statementHtml: string;
  definitionsHtml?: string;
  partialResultsHtml?: string;
  claimedProofsHtml?: string;
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
  claimedProofsHtml,
  additionalReferencesHtml,
  notesHtml,
  suggestEditHref,
  sectionHeadingTag = "h2",
}: ProblemBodyProps) {
  const SectionHeading = sectionHeadingTag;

  // Author/title/venue/year join with ", " only between parts that are
  // actually present, so a partially- or fully-blank reference never leaves
  // a stray comma. Link/DOI stay as unconditional parenthetical suffixes.
  const referenceParts: React.ReactNode[] = [];
  if (canonicalReference.author) referenceParts.push(canonicalReference.author);
  if (canonicalReference.title) referenceParts.push(<em key="title">{canonicalReference.title}</em>);
  if (canonicalReference.venue) referenceParts.push(canonicalReference.venue);
  if (canonicalReference.year) referenceParts.push(String(canonicalReference.year));
  const hasReference =
    referenceParts.length > 0 || !!canonicalReference.link || !!canonicalReference.doi;

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

      {hasReference && (
        <details className="problem-section">
          <summary className="section-heading reference-summary">
            Reference for the problem statement
          </summary>
          <p>
            {referenceParts.map((part, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {part}
              </span>
            ))}
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
        </details>
      )}

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

      {claimedProofsHtml && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Claimed Proofs</SectionHeading>
          <div dangerouslySetInnerHTML={{ __html: claimedProofsHtml }} />
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
