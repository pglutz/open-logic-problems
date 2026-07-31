import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { problemFrontmatterSchema, pendingProblemSchema } from "./lib/problemSchema";

// Non-recursive pattern ("*.md", not "**/*.md") deliberately excludes
// problems/pending/ — files awaiting ID assignment by the GitHub Action
// should never be validated against this schema (their id is null).
const problems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./problems" }),
  schema: problemFrontmatterSchema,
});

// New-problem proposals awaiting ID assignment. Rendered at
// /problems/pending/[slug] purely so a PR's Vercel preview deploy has a
// real page to look at — never linked to from anywhere on the site.
const pendingProblems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./problems/pending" }),
  schema: pendingProblemSchema,
});

export const collections = { problems, pendingProblems };
