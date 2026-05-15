/**
 * 영단어 발음 — 브라우저 내장 SpeechSynthesis API 래퍼.
 * iOS Safari는 첫 호출 전 사용자 제스처 필요 (버튼 클릭으로 트리거됨).
 */

type SpeakOptions = {
  rate?: number;    // 0.5~2.0 (기본 0.9 — 학습용 약간 느리게)
  pitch?: number;   // 0~2 (기본 1)
  lang?: string;    // 기본 'en-US'
  onStart?: () => void;
  onEnd?: () => void;
};

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (cachedVoice && cachedVoice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) {
    return cachedVoice;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const ranked = voices
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) =>
        v.lang === 'en-US' ? 3 : v.lang === 'en-GB' ? 2 : 1;
      return score(b) - score(a);
    });
  cachedVoice = ranked[0] ?? null;
  return cachedVoice;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakEnglish(text: string, opts: SpeakOptions = {}): void {
  if (!isTtsSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = opts.lang ?? 'en-US';
  utt.rate = opts.rate ?? 0.9;
  utt.pitch = opts.pitch ?? 1;
  const voice = pickVoice(utt.lang);
  if (voice) utt.voice = voice;
  if (opts.onStart) utt.onstart = opts.onStart;
  if (opts.onEnd) {
    utt.onend = opts.onEnd;
    utt.onerror = opts.onEnd;
  }
  synth.speak(utt);
}
