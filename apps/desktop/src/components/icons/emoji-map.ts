/**
 * Emoji → lucide 매핑 테이블.
 *
 * 마이그레이션 가이드:
 *   1. 페이지에서 이모지 발견 → 이 표에서 lucide name 찾기
 *   2. `<Icon name="..." />` 로 교체
 *   3. 매핑이 없으면 https://lucide.dev/icons 에서 의미 가까운 것 선택 후 본 표에 추가
 *
 * 본 표는 단순 reference (codemod 입력) — 실제로는 컨텍스트에 따라 다른
 * 아이콘이 더 맞을 수 있으니 항상 검토 후 교체할 것.
 *
 * 통계 (2026-05-14 기준):
 *   apps/desktop/src/pages 전체 29 종 87회 사용 중
 *   migration progress: HomeroomConsultationsPage 완료
 */
export const EMOJI_TO_LUCIDE: Record<string, string> = {
  // ── 화살표 (navigation / direction) ──
  '→': 'ArrowRight',
  '←': 'ArrowLeft',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '▶': 'ChevronRight',
  '◀': 'ChevronLeft',
  '▼': 'ChevronDown',
  '▲': 'ChevronUp',
  '▾': 'ChevronDown',
  '▴': 'ChevronUp',

  // ── 상태 마커 ──
  '✓': 'Check',
  '✔': 'Check',
  '✗': 'X',
  '✕': 'X',
  '⚠': 'AlertTriangle',
  '●': 'Circle',
  '◇': 'Diamond',
  '★': 'Star',
  '☆': 'Star',  // 빈 별 — variant prop 또는 fill 처리

  // ── 액션 ──
  '✏': 'Pencil',
  '✎': 'Pencil',
  '☐': 'Square',
  '☑': 'CheckSquare',
  '⏱': 'Timer',
  '⏸': 'Pause',
  '👁': 'Eye',
  '🔗': 'Link',
  '📎': 'Paperclip',
  '🎲': 'Dices',
};

/**
 * 마이그레이션 안 된 이모지 자동 감지용.
 * 빌드 시 grep 으로 사용:
 *   grep -rP "$(node -e \"console.log(Object.keys(require('./emoji-map').EMOJI_TO_LUCIDE).join('|'))\")" src/pages/
 */
export const EMOJI_REGEX_PATTERN = Object.keys(EMOJI_TO_LUCIDE).join('|');
