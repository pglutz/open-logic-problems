import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * The one markdown->HTML pipeline for problem body content.
 * Used both at Astro build time and (later) client-side in the live-preview
 * editor, so preview and production rendering never drift apart.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify);

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/**
 * Comments are authored by any signed-in user and shown to everyone as soon
 * as they're posted (no PR review, unlike problem content), so this
 * sanitizes the parsed tree before rendering. Sanitizing runs *before*
 * rehype-katex expands math nodes into KaTeX's markup, so the schema only
 * needs to recognize the small `span.math` wrapper remark-math produces,
 * not KaTeX's large internal class vocabulary — and KaTeX's own output is
 * trusted since rehype-katex renders with KaTeX's default `trust: false`,
 * which disables LaTeX commands (like \href) that could otherwise inject
 * arbitrary links.
 */
const commentSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    div: [...(defaultSchema.attributes?.div ?? []), "className"],
  },
};

const commentProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeSanitize, commentSchema)
  .use(rehypeKatex)
  .use(rehypeStringify);

export async function renderCommentMarkdown(markdown: string): Promise<string> {
  const file = await commentProcessor.process(markdown);
  return String(file);
}
