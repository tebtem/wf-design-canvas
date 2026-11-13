/** Rich text helpers that do not need the editor library (kept out of the main bundle). */

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Text saved before rich text existed is plain, with "• " bullet lines. Turns it into simple HTML so
 * the editor shows real bullets. Rich text (already HTML) passes through; the editor only keeps the
 * formatting it supports, so nothing else can get in.
 */
export function toRichHtml(value: string): string {
  const v = value ?? '';
  if (!v.trim()) return '';
  if (v.trimStart().startsWith('<')) return v;
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li><p>${escape(li)}</p></li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of v.split('\n')) {
    const bullet = line.match(/^\s*[•\-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim()) out.push(`<p>${escape(line)}</p>`);
  }
  flush();
  return out.join('');
}

/** Plain text of rich content, for screen reader labels and checks. */
export const richToText = (html: string) =>
  html
    .replace(/<\/(p|h3|li)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
