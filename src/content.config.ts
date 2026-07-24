import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { AREAS } from "./lib/areas";

// Non-recursive pattern ("*.md", not "**/*.md") deliberately excludes
// problems/pending/ — files awaiting ID assignment by the GitHub Action
// should never be validated against this schema (their id is null).
const problems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./problems" }),
  schema: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    status: z.enum(["open", "closed", "claimed-proof-no-consensus"]),
    area: z.array(z.enum(AREAS)).min(1),
    impact: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    canonical_reference: z.object({
      title: z.string(),
      author: z.string(),
      venue: z.string().optional(),
      year: z.number().int().optional(),
      link: z.string().url().optional(),
    }),
  }),
});

export const collections = { problems };
