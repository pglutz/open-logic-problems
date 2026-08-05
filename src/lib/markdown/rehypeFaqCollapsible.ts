import type { Element, ElementContent, Root, RootContent } from "hast";

const HEADING_TAGS = new Set(["h1", "h2", "h3"]);

function isHeading(node: RootContent): node is Element {
  return node.type === "element" && HEADING_TAGS.has(node.tagName);
}

/**
 * Wraps each top-level `h3` and the nodes following it (up to the next
 * heading) into a `<details><summary>` so FAQ questions collapse by default.
 * Markdown flattens headings and their content into sibling nodes at the
 * root, so grouping "everything until the next heading" is a linear scan.
 */
export function rehypeFaqCollapsible() {
  return (tree: Root) => {
    const children: RootContent[] = [];
    let i = 0;
    while (i < tree.children.length) {
      const node = tree.children[i];
      if (node.type === "element" && node.tagName === "h3") {
        const body: RootContent[] = [];
        i++;
        while (i < tree.children.length && !isHeading(tree.children[i])) {
          body.push(tree.children[i]);
          i++;
        }
        children.push({
          type: "element",
          tagName: "details",
          properties: { className: ["faq-item"] },
          children: [
            { type: "element", tagName: "summary", properties: {}, children: node.children },
            ...(body as ElementContent[]),
          ],
        });
      } else {
        children.push(node);
        i++;
      }
    }
    tree.children = children;
  };
}
