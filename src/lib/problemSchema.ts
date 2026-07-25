import { z } from "zod";
import { AREAS } from "./areas";

export const problemFrontmatterSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  status: z.enum(["open", "closed", "claimed-proof-no-consensus"]),
  area: z.array(z.enum(AREAS)).min(1),
  impact: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  canonical_reference: z.object({
    title: z.string(),
    author: z.string(),
    venue: z.string().optional(),
    year: z.number().int().optional(),
    link: z.string().url().optional(),
    doi: z.string().optional(),
  }),
});

export type ProblemFrontmatter = z.infer<typeof problemFrontmatterSchema>;
export type CanonicalReference = ProblemFrontmatter["canonical_reference"];
