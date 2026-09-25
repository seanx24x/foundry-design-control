import { createHash } from 'node:crypto';

/** A bounded HTML start tag, not the element subtree or an arbitrary line window. */
export function sourceLineAnchor(path: string, lines: string[], line: number, symbol?: string) {
  let text = lines[line - 1]!;
  let endLine = line;
  if (/\.html?$/i.test(path) && /^\s*<[a-z][\w:-]*(?=[\s/>]|$)/i.test(text)) {
    const start = text.indexOf('<');
    const bounded = lines
      .slice(line - 1, line + 63)
      .join('\n')
      .slice(start, start + 16_384);
    let quote = '';
    for (let index = 1; index < bounded.length; index++) {
      const char = bounded[index]!;
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '<' || char === '{') {
        // Not a plain HTML opening tag. Keep the conservative single-line anchor.
        break;
      } else if (char === '>') {
        text = bounded.slice(0, index + 1);
        endLine = line + (text.match(/\n/g)?.length ?? 0);
        break;
      }
    }
  }
  return {
    line,
    endLine,
    symbol,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}
