/**
 * Splits streamed Markdown into a "safe" prefix that's fine to feed to a Markdown/KaTeX
 * renderer right now, and a "pending" trailing chunk that ends mid-LaTeX-delimiter — holding
 * that back avoids flashing a broken/unrendered `$...$` or `$$...$$` block while it's still typing.
 * Once the closing delimiter streams in, the whole thing becomes "safe" again.
 */
export function splitStreamingMarkdown(text: string): { safe: string; pending: string } {
  const blockDelimiters = [...text.matchAll(/\$\$/g)];
  if (blockDelimiters.length % 2 === 1) {
    const lastIndex = blockDelimiters[blockDelimiters.length - 1].index ?? text.length;
    return { safe: text.slice(0, lastIndex), pending: text.slice(lastIndex) };
  }

  const withoutBlocks = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => " ".repeat(match.length));
  const singleDelimiters = [...withoutBlocks.matchAll(/\$/g)];
  if (singleDelimiters.length % 2 === 1) {
    const lastDollar = text.lastIndexOf("$");
    return { safe: text.slice(0, lastDollar), pending: text.slice(lastDollar) };
  }

  return { safe: text, pending: "" };
}
