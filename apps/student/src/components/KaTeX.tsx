import { useMemo } from 'react';
import katex from 'katex';

interface Props {
  content: string;
  className?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

/** KaTeX 수식이 포함된 텍스트 렌더링. $...$ 는 KaTeX, 나머지는 HTML-escape. */
export default function KaTeX({ content, className }: Props) {
  const html = useMemo(() => {
    const parts = content.split(/(\$[^$]+\$)/g);
    return parts.map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const tex = part.slice(1, -1);
        try {
          return katex.renderToString(tex, { throwOnError: false });
        } catch {
          return escapeHtml(tex);
        }
      }
      return escapeHtml(part);
    }).join('');
  }, [content]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
