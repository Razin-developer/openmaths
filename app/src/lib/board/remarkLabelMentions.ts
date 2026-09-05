import { findAndReplace } from "mdast-util-find-and-replace";
import type { PhrasingContent, Root } from "mdast";

/**
 * Remark plugin: rewrites whole-word matches of known diagram labels (e.g. "AB", "∠B")
 * found in the AI's prose into a custom mdast node carrying `data.hName: "label-mention"`,
 * so react-markdown can render them as hoverable spans wired to the diagram's hover state
 * (see markdownComponents' "label-mention" entry).
 */
export function remarkLabelMentions(labelMap: Map<string, string>) {
  return function transformer(tree: Root) {
    if (labelMap.size === 0) return;

    const labels = Array.from(labelMap.keys())
      .filter((label) => label.trim().length > 0)
      .sort((a, b) => b.length - a.length);
    if (labels.length === 0) return;

    const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "gu");

    findAndReplace(tree, [
      [
        pattern,
        (match: string) => {
          const opId = labelMap.get(match);
          if (!opId) return false;
          // Custom mdast node type (not a standard PhrasingContent variant) — react-markdown
          // renders it via the "label-mention" hName/components entry, see markdownComponents.
          return {
            type: "label-mention",
            data: {
              hName: "label-mention",
              hProperties: { label: match, opId },
            },
            children: [{ type: "text", value: match }],
          } as unknown as PhrasingContent;
        },
      ],
    ]);
  };
}
