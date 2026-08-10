import StatusBadge from "./StatusBadge";
import ImpactMarks from "./ImpactMarks";
import AreaTags from "./AreaTags";
import type { ProblemStatus } from "../../lib/problems";
import type { CanonicalReference, Reference } from "../../lib/problemSchema";

// Author/title/venue/year join with ", " only between parts that are
// actually present, so a partially- or fully-blank reference never leaves a
// stray comma. Link/DOI stay as unconditional parenthetical suffixes. Shared
// by the canonical reference and every entry of the additional-references
// list below.
function referenceParts(ref: { title: string; author: string; venue?: string; year?: number }) {
  const parts: React.ReactNode[] = [];
  if (ref.author) parts.push(ref.author);
  if (ref.title) parts.push(<em key="title">{ref.title}</em>);
  if (ref.venue) parts.push(ref.venue);
  if (ref.year) parts.push(String(ref.year));
  return parts;
}

function ReferenceEntry({
  reference,
  id,
}: {
  reference: CanonicalReference | Reference;
  id?: string;
}) {
  const parts = referenceParts(reference);
  return (
    <p id={id}>
      {reference.key && <span className="reference-key-prefix">[{reference.key}]</span>}
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {part}
        </span>
      ))}
      {reference.link && (
        <>
          {" "}
          [<a href={reference.link}>link</a>]
        </>
      )}
      {reference.doi && (
        <>
          {" "}
          [<a href={`https://doi.org/${reference.doi}`}>doi</a>]
        </>
      )}
    </p>
  );
}

interface ProblemBodyProps {
  status: ProblemStatus;
  impact: 1 | 2 | 3;
  area: string[];
  canonicalReference: CanonicalReference;
  references: Reference[];
  statementHtml: string;
  definitionsHtml?: string;
  partialResultsHtml?: string;
  claimedProofsHtml?: string;
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
  references,
  statementHtml,
  definitionsHtml,
  partialResultsHtml,
  claimedProofsHtml,
  notesHtml,
  suggestEditHref,
  sectionHeadingTag = "h2",
}: ProblemBodyProps) {
  const SectionHeading = sectionHeadingTag;

  const hasCanonicalReference =
    referenceParts(canonicalReference).length > 0 || !!canonicalReference.link || !!canonicalReference.doi;

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

      {hasCanonicalReference && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Reference for the problem statement</SectionHeading>
          <ReferenceEntry
            reference={canonicalReference}
            id={canonicalReference.key ? `ref-${canonicalReference.key}` : undefined}
          />
        </section>
      )}

      {references.length > 0 && (
        <section className="problem-section">
          <SectionHeading className="section-heading">Additional References</SectionHeading>
          {references.map((ref) => (
            <ReferenceEntry key={ref.key} reference={ref} id={`ref-${ref.key}`} />
          ))}
        </section>
      )}
    </>
  );
}
