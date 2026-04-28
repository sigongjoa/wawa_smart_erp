/**
 * HTML 텍스트 노드용 escape — `document.write`/`innerHTML`/템플릿 리터럴에
 * 사용자 데이터를 박을 때 사용. 속성값(attribute)에는 추가 검토 필요.
 */
export function escapeHtml(input: unknown): string {
  if (input == null) return '';
  const s = typeof input === 'string' ? input : String(input);
  return s.replace(/[&<>"']/g, (c) => HTML_ENTITY_MAP[c] || c);
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
