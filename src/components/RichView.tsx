import type { ReactNode } from 'react';
import { toRichHtml } from './richText';

/**
 * Shows saved rich text without loading the editor. Only titles, paragraphs, bullets, bold and italic
 * are turned into elements; anything else becomes plain text, so nothing unsafe can render.
 */
export function RichView({ value, allowTitle = false }: { value: string; allowTitle?: boolean }) {
  const html = toRichHtml(value);
  if (!html) return null;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  let key = 0;
  const walk = (node: Node): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const children = Array.from(node.childNodes).map(walk);
    const k = key++;
    switch ((node as Element).tagName) {
      case 'P':
        return <p key={k}>{children}</p>;
      case 'H3':
      case 'H2':
      case 'H1':
        return allowTitle ? <h3 key={k}>{children}</h3> : <p key={k}>{children}</p>;
      case 'UL':
      case 'OL':
        return <ul key={k}>{children}</ul>;
      case 'LI':
        return <li key={k}>{children}</li>;
      case 'STRONG':
      case 'B':
        return <strong key={k}>{children}</strong>;
      case 'EM':
      case 'I':
        return <em key={k}>{children}</em>;
      case 'BR':
        return <br key={k} />;
      default:
        return <span key={k}>{children}</span>;
    }
  };
  return <>{Array.from(doc.body.childNodes).map(walk)}</>;
}
