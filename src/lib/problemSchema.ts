import { z } from "zod";
import { AREAS } from "./areas.ts";

// Keys double as URL fragments (`#ref-<key>`) and appear inside `[^key]`
// citation syntax, so they're restricted to characters that are safe in both.
const referenceKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9-]+$/, "Keys may contain only letters, digits, and hyphens");

const referenceFields = {
  title: z.string().max(500),
  author: z.string().max(500),
  venue: z.string().max(500).optional(),
  year: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  link: z.url().max(500).optional(),
  doi: z.string().max(500).optional(),
};

// Used for each entry of the `references` array — key is unconditionally
// required, since a blank entry is never submitted in the first place (the
// editor drops fully-blank rows before sending).
const referenceSchema = z.object({ key: referenceKeySchema, ...referenceFields });

// Fields shared by an assigned problem and one still awaiting an id.
const problemCoreFields = {
  name: z.string().min(1).max(500),
  status: z.enum(["open", "closed", "claimed-proof-no-consensus"]),
  area: z.array(z.enum(AREAS)).min(1),
  impact: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // Unlike a `references[]` entry, this single field can legitimately be left
  // entirely blank ("unusual cases") — so its key is only conditionally
  // required, enforced below via superRefine rather than at the field level.
  canonical_reference: z.object({ key: referenceKeySchema.optional(), ...referenceFields }),
  references: z.array(referenceSchema).max(50).default([]),
};

// Shared by both schemas below: keys must be unique across the canonical
// reference and every additional reference (they share one `#ref-<key>`
// anchor namespace), and the canonical reference needs a key as soon as it
// has any actual content to cite.
function checkReferenceKeys(
  data: { canonical_reference: { key?: string; title: string; author: string }; references: { key: string }[] },
  ctx: z.RefinementCtx,
) {
  const { canonical_reference, references } = data;
  if (!canonical_reference.key && (canonical_reference.title || canonical_reference.author)) {
    ctx.addIssue({
      code: "custom",
      path: ["canonical_reference", "key"],
      message: "A key is required once the reference has a title or author.",
    });
  }
  const seen = new Map<string, number>();
  if (canonical_reference.key) seen.set(canonical_reference.key, 1);
  references.forEach((ref, i) => {
    const count = (seen.get(ref.key) ?? 0) + 1;
    seen.set(ref.key, count);
    if (count > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["references", i, "key"],
        message: `Duplicate reference key "${ref.key}".`,
      });
    }
  });
}

export const problemFrontmatterSchema = z
  .object({
    id: z.number().int().positive(),
    ...problemCoreFields,
  })
  .superRefine(checkReferenceKeys);

export const pendingProblemSchema = z
  .object({
    id: z.null(),
    ...problemCoreFields,
  })
  .superRefine(checkReferenceKeys);

export type ProblemFrontmatter = z.infer<typeof problemFrontmatterSchema>;
export type CanonicalReference = ProblemFrontmatter["canonical_reference"];
export type Reference = ProblemFrontmatter["references"][number];
export type PendingProblemFrontmatter = z.infer<typeof pendingProblemSchema>;
