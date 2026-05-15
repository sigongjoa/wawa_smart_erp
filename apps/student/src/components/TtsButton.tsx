import { CSSProperties, MouseEvent, useEffect, useState } from 'react';
import { isTtsSupported, speakEnglish } from '../utils/tts';
import './TtsButton.css';

type Props = {
  text: string;
  size?: number;
  className?: string;
  label?: string;
};

/**
 * TtsButton — 영단어 발음 청취.
 *
 * 디자인 (STUDENT.md · IMPECCABLE):
 *   - 정보(단어)가 주인공, TTS는 도구 → 평상시 ghost
 *   - 재생 중에는 type-water 채움 + 2px ring (Pokemon type chip 톤)
 *   - 진입 모션 한 번, ease-out-quart
 *   - 모바일 터치 타겟 ::before로 확장
 */
export default function TtsButton({ text, size = 18, className = '', label }: Props) {
  const [speaking, setSpeaking] = useState(false);

  // 페이지 이탈 시 발화 중이면 중단
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // 이 버튼이 speaking 중이었을 때만 cancel — 다른 버튼의 발화는 보호
        if (speaking) window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isTtsSupported() || !text.trim()) return null;

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    speakEnglish(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  };

  return (
    <button
      type="button"
      className={`tts-btn ${speaking ? 'is-speaking' : ''} ${className}`}
      onClick={onClick}
      aria-label={label ?? `${text} 발음 듣기`}
      aria-pressed={speaking}
      title="발음 듣기"
      style={{ '--tts-icon-size': `${size}px` } as CSSProperties}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}
