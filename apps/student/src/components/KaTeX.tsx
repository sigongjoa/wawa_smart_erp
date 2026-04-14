import { useMemo } from 'react';
import katex from 'katex';

interface Props {
  content: string;
  className?: string;
}

/** KaTeX 수식이 포함된 텍스트를 렌더링. $...$ 패턴을 수식으로 변환 */
export default function KaTeX({ content, className }: Props) {
  const html = useMemo(() => {
    return content.replace(/\$([^$]+)\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex, { throwOnError: false });
      } catch {
        return tex;
      }
    });
  }, [content]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
