import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit, SKIP } from "unist-util-visit";
import type { Root, Text } from "mdast";
import type { VFile } from "vfile";

/**
 * `[^key]` citation syntax, resolved against the `validKeys` set passed to
 * `renderMarkdown`/`renderIfPresent` via `file.data`. Deliberately NOT
 * remark-gfm's built-in footnote feature — that requires an inline `[^key]:
 * definition` line in the same document and renders one auto-numbered
 * "Footnotes" section, which can't be split into the two separately-headed
 * "Reference for the problem statement" / "Additional References" sections
 * the page needs. Here `[^key]` resolves against reference data that lives
 * in frontmatter, not the body, so it's parsed as our own syntax instead:
 * confirmed empirically that remark-gfm leaves undefined `[^key]` as plain
 * literal text (never a footnoteReference node) when no matching definition
 * exists, so this plugin can safely claim the syntax via a simple text-node
 * regex without any conflict.
 */
const remarkCitations: Plugin<[], Root> = () => (tree, file: VFile) => {
  const validKeys = (file.data.validKeys as ReadonlySet<string> | undefined) ?? new Set<string>();

  visit(tree, "text", (node: Text, index, parent) => {
    if (index == null || !parent) return;
    // Don't rewrite citation-looking text inside an existing link's own label.
    if (parent.type === "link" || parent.type === "linkReference") return;

    const pattern = /\[\^([A-Za-z0-9-]+)\]/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    const newNodes: Array<Record<string, unknown>> = [];
    while ((match = pattern.exec(node.value))) {
      if (match.index > lastEnd) {
        newNodes.push({ type: "text", value: node.value.slice(lastEnd, match.index) });
      }
      const key = match[1];
      if (validKeys.has(key)) {
        newNodes.push({
          type: "link",
          url: `#ref-${key}`,
          children: [{ type: "text", value: `[${key}]` }],
          data: { hProperties: { className: ["citation-link"] } },
        });
      } else {
        newNodes.push({
          type: "citationUnresolved",
          data: { hName: "span", hProperties: { className: ["citation-unresolved"] } },
          children: [{ type: "text", value: match[0] }],
        });
      }
      lastEnd = match.index + match[0].length;
    }
    if (newNodes.length === 0) return;
    if (lastEnd < node.value.length) {
      newNodes.push({ type: "text", value: node.value.slice(lastEnd) });
    }

    parent.children.splice(index, 1, ...(newNodes as never[]));
    // Skip past the nodes just inserted — otherwise `visit` re-descends into
    // the unresolved-citation node (whose child text still literally
    // contains `[^key]`) and wraps it a second time.
    return [SKIP, index + newNodes.length];
  });
};

/**
 * The one markdown->HTML pipeline for problem body content.
 * Used both at Astro build time and (later) client-side in the live-preview
 * editor, so preview and production rendering never drift apart.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkCitations)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify);

export async function renderMarkdown(
  markdown: string,
  validKeys?: ReadonlySet<string>,
): Promise<string> {
  const file = await processor.process({ value: markdown, data: { validKeys: validKeys ?? new Set() } });
  return String(file);
}

/** Renders an optional section's markdown, passing through `undefined` for blank/absent content. */
export function renderIfPresent(
  markdown: string | undefined,
  validKeys?: ReadonlySet<string>,
): Promise<string | undefined> {
  return markdown?.trim() ? renderMarkdown(markdown, validKeys) : Promise.resolve(undefined);
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
