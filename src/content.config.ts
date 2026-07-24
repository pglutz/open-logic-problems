import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { problemFrontmatterSchema } from "./lib/problemSchema";

// Non-recursive pattern ("*.md", not "**/*.md") deliberately excludes
// problems/pending/ — files awaiting ID assignment by the GitHub Action
// should never be validated against this schema (their id is null).
const problems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./problems" }),
  schema: problemFrontmatterSchema,
});

export const collections = { problems };
