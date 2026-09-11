/**
 * Article body rendering.
 *
 * Content is rendered as structured elements, never injected as HTML. An
 * article is operator-entered text, and `dangerouslySetInnerHTML` on
 * operator-entered text is a stored-XSS vector that would let anyone with
 * editorial access run script in every reader's browser - including in a
 * signed-in customer's session.
 *
 * The supported syntax is deliberately small, because every addition is another
 * thing to get right: `## ` and `### ` headings, `- ` bullets, `> ` quotes, and
 * blank-line-separated paragraphs. Anything else is a paragraph, which is the
 * safe default rather than a silent failure.
 */
type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; text: string };

export function parseArticleBody(content: string): Block[] {
  const blocks: Block[] = [];

  for (const chunk of content.split(/\n\s*\n/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map((line) => line.trim());

    if (lines.every((line) => line.startsWith("- "))) {
      blocks.push({ kind: "list", items: lines.map((line) => line.slice(2).trim()) });
      continue;
    }

    if (lines[0].startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: lines[0].slice(4).trim() });
      // A heading may be followed by prose in the same chunk.
      const rest = lines.slice(1).join(" ").trim();
      if (rest) blocks.push({ kind: "paragraph", text: rest });
      continue;
    }

    if (lines[0].startsWith("## ")) {
      blocks.push({ kind: "heading", level: 2, text: lines[0].slice(3).trim() });
      const rest = lines.slice(1).join(" ").trim();
      if (rest) blocks.push({ kind: "paragraph", text: rest });
      continue;
    }

    if (lines[0].startsWith("> ")) {
      blocks.push({ kind: "quote", text: lines.map((line) => line.replace(/^>\s?/, "")).join(" ") });
      continue;
    }

    blocks.push({ kind: "paragraph", text: lines.join(" ") });
  }

  return blocks;
}

export function ArticleBody({ content }: { content: string }) {
  const blocks = parseArticleBody(content);

  return (
    <div className="grid gap-5">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h2 className="mt-4 heading-md text-foreground" key={index}>
                {block.text}
              </h2>
            ) : (
              <h3 className="mt-2 heading-sm text-foreground" key={index}>
                {block.text}
              </h3>
            );
          case "list":
            return (
              <ul className="grid gap-2 pl-1" key={index}>
                {block.items.map((item) => (
                  <li className="flex gap-2.5 body-md text-foreground-secondary" key={item}>
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-premium" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                className="border-l-2 border-premium pl-5 body-lg italic text-foreground-secondary"
                key={index}
              >
                {block.text}
              </blockquote>
            );
          default:
            return (
              <p className="body-md leading-relaxed text-foreground-secondary" key={index}>
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
