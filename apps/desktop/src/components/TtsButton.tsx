import { CSSProperties, MouseEvent, useEffect, useState } from 'react';
import { isTtsSupported, speakEnglish } from '../utils/tts';
import { Icon } from './icons/Icon';
import './TtsButton.css';

type Props = {
  text: string;
  size?: number;
  className?: string;
  label?: string;
};

/**
 * TtsButton (Desktop) — 영단어 발음 청취.
 *
 * 디자인 (DESKTOP.md):
 *   - lucide-react via Icon 컴포넌트 (자체 SVG 금지 가이드 준수)
 *   - ghost variant 톤 — 평상시 transparent, hover에서 primary surface 노출
 *   - 재생 중에는 primary 채움 + 2px ring
 */
export default function TtsButton({ text, size = 14, className = '', label }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis && speaking) {
        window.speechSynthesis.cancel();
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
      <Icon name="Volume2" size={size} aria-hidden />
    </button>
  );
}
