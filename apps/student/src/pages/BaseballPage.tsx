import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type BaseballWord, type BaseballWordsResponse } from '../api';
import './BaseballPage.css';

type Tier = 1 | 2 | 3 | 4;
const TIER_LABEL: Record<Tier, string> = {
  1: '중1·2 기초',
  2: '중3 빈출',
  3: '고1·2 수능기초',
  4: '고3·수능 심화',
};

const THROW_MS = 2800;
const MAX_INNING = 4;
const MAX_PITCHES_PER_HALF = 7;
const BEST_KEY = 'wb_best_v1';

type Half = 'top' | 'bottom';

interface PlayLog {
  inning: number;
  half: Half;
  wordId: string | null;
  word: string;
  ko: string;
  picked: string | null;
  elapsed: number | null;
  result: string;
  correct: boolean;
}

interface Stats {
  totalHR: number;
  totalK: number;
  totalWalk: number;
  totalOut: number;
  totalAnswered: number;
  totalCorrect: number;
  fastestMs: number | null;
}

interface BestRecord {
  myScore: number;
  oppScore: number;
  diff: number;
  hr: number;
  k: number;
  acc: number;
  ts: number;
}

interface Question {
  wordId: string;
  eng: string;
  ko: string;
  prompt: string;
  answer: string;
  options: string[];
  direction: 'ko2en' | 'en2ko';
  startAt: number;
  answered: boolean;
}

type WordsByTier = Record<Tier, BaseballWord[]>;
type SourceByTier = Record<Tier, BaseballWordsResponse['source']>;

// ===== WebAudio synth =====
function createAudio() {
  let ctx: AudioContext | null = null;
  let muted = false;
  const ensure = (): AudioContext | null => {
    if (muted) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
      catch { ctx = null; }
    }
    return ctx;
  };
  const tone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, delay = 0) => {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  const slide = (f1: number, f2: number, dur: number, type: OscillatorType = 'sawtooth', vol = 0.2) => {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  return {
    resume: () => { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    toggle: () => { muted = !muted; return muted; },
    isMuted: () => muted,
    batCrack: () => { tone(220, 0.08, 'sawtooth', 0.3); tone(90, 0.15, 'triangle', 0.25, 0.02); },
    strike:   () => { tone(900, 0.06, 'square', 0.2); tone(1300, 0.06, 'square', 0.2, 0.08); },
    ballCall: () => { tone(350, 0.12, 'sine', 0.12); },
    homerun:  () => { [440, 554, 659, 880, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.08)); },
    out:      () => { slide(280, 100, 0.35, 'sawtooth', 0.25); },
    walk:     () => { tone(440, 0.1, 'sine', 0.15); tone(330, 0.14, 'sine', 0.15, 0.12); },
    pitch:    () => { slide(700, 1100, 0.08, 'triangle', 0.08); },
    click:    () => { tone(1200, 0.03, 'square', 0.08); },
  };
}

const vibe = (p: number | number[]) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* ignore */ } };

function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadBest(): BestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) as BestRecord : null;
  } catch { return null; }
}
function saveBest(rec: BestRecord) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

const TIERS: Tier[] = [1, 2, 3, 4];

export default function BaseballPage() {
  const navigate = useNavigate();
  const audioRef = useRef(createAudio());
  const audio = audioRef.current;

  // ── Game state ──
  const [inning, setInning] = useState(1);
  const [half, setHalf] = useState<Half>('top');
  const [outs, setOuts] = useState(0);
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [bases, setBases] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [pitchesThisHalf, setPitchesThisHalf] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalHR: 0, totalK: 0, totalWalk: 0, totalOut: 0,
    totalAnswered: 0, totalCorrect: 0, fastestMs: null,
  });
  const [gameLog, setGameLog] = useState<PlayLog[]>([]);

  // ── Word pool from API ──
  const [wordsByTier, setWordsByTier] = useState<WordsByTier | null>(null);
  const [sourceByTier, setSourceByTier] = useState<SourceByTier | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [finishSubmitted, setFinishSubmitted] = useState(false);

  // ── UI state ──
  const [current, setCurrent] = useState<Question | null>(null);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'start' | 'playing' | 'review' | 'end'>('start');
  const [pickedAnswer, setPickedAnswer] = useState<string | null>(null);
  const [showAnswerMark, setShowAnswerMark] = useState(false);
  const [calloutText, setCalloutText] = useState('');
  const [calloutClass, setCalloutClass] = useState('');
  const [calloutVisible, setCalloutVisible] = useState(false);
  const [xpText, setXpText] = useState('');
  const [xpVisible, setXpVisible] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ cx: number; cy: number; cr: number; color: string; delay: number }>>([]);
  const [ballAnim, setBallAnim] = useState<'' | 'throwing-off' | 'throwing-def' | 'hit' | 'hit-homerun' | 'missed' | 'struck'>('');
  const [batterSwung, setBatterSwung] = useState<'' | 'swung' | 'whiff'>('');
  const [pitcherThrew, setPitcherThrew] = useState(false);
  const [timerBarRunning, setTimerBarRunning] = useState(false);

  const pitchTimeoutRef = useRef<number | null>(null);
  const calloutQRef = useRef<Array<{ text: string; cls: string; hold: number }>>([]);
  const calloutRunningRef = useRef(false);
  const calloutTimerRef = useRef<number | null>(null);
  const gameIdRef = useRef<string>('');

  // ── Derived ──
  const isOffense = half === 'top';
  const pitchesLeft = Math.max(0, MAX_PITCHES_PER_HALF - pitchesThisHalf);
  const tier = inning as Tier;
  const currentPool = wordsByTier?.[tier] ?? [];
  const currentSource = sourceByTier?.[tier];

  // ── Callout queue ──
  const drainCallout = useCallback(() => {
    const next = calloutQRef.current.shift();
    if (!next) { calloutRunningRef.current = false; return; }
    calloutRunningRef.current = true;
    setCalloutText(next.text);
    setCalloutClass(next.cls);
    setCalloutVisible(false);
    window.setTimeout(() => setCalloutVisible(true), 0);
    calloutTimerRef.current = window.setTimeout(() => {
      setCalloutVisible(false);
      calloutTimerRef.current = window.setTimeout(drainCallout, 150);
    }, next.hold);
  }, []);

  const showCallout = useCallback((text: string, cls: string, hold = 1200) => {
    calloutQRef.current.push({ text, cls, hold });
    if (!calloutRunningRef.current) drainCallout();
  }, [drainCallout]);

  const showXP = (text: string) => {
    setXpText(text);
    setXpVisible(false);
    window.setTimeout(() => setXpVisible(true), 0);
  };
  const screenFlash = () => {
    setFlashOn(false);
    window.setTimeout(() => setFlashOn(true), 0);
  };
  const burstConfetti = () => {
    const colors = ['#ffc800', '#58cc02', '#1cb0f6', '#ff4b4b', '#fff'];
    const pieces = [];
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 180 + Math.random() * 200;
      pieces.push({
        cx: Math.cos(angle) * dist,
        cy: Math.sin(angle) * dist,
        cr: Math.random() * 1200 - 600,
        color: colors[i % colors.length],
        delay: Math.random() * 0.1,
      });
    }
    setConfettiPieces(pieces);
    window.setTimeout(() => setConfettiPieces([]), 1500);
  };

  const advanceRunners = useCallback((basesGained: number): { runs: number; newBases: [boolean, boolean, boolean] } => {
    let runs = 0;
    const newBases: [boolean, boolean, boolean] = [false, false, false];
    for (let i = 0; i < 3; i++) {
      if (!bases[i]) continue;
      const newPos = i + basesGained;
      if (newPos >= 3) runs++;
      else newBases[newPos] = true;
    }
    if (basesGained >= 4) runs++;
    else newBases[basesGained - 1] = true;
    return { runs, newBases };
  }, [bases]);

  const pickQuestion = useCallback((): Omit<Question, 'startAt' | 'answered'> | null => {
    const pool = wordsByTier?.[tier] ?? [];
    if (pool.length < 4) return null;
    const [picked, d1, d2, d3] = shuffle(pool).slice(0, 4);
    const ko2en = isOffense;
    const prompt = ko2en ? picked.korean : picked.english;
    const answer = ko2en ? picked.english : picked.korean;
    const distractors = ko2en
      ? [d1.english, d2.english, d3.english]
      : [d1.korean, d2.korean, d3.korean];
    const options = shuffle([answer, ...distractors]);
    return {
      wordId: picked.id,
      eng: picked.english,
      ko: picked.korean,
      prompt, answer, options,
      direction: ko2en ? 'ko2en' : 'en2ko',
    };
  }, [wordsByTier, tier, isOffense]);

  const logPlay = (entry: Omit<PlayLog, 'inning' | 'half'>) => {
    setGameLog((l) => [...l, { inning, half, ...entry }]);
  };

  // ── Throw pitch ──
  const throwPitch = useCallback(() => {
    if (outs >= 3 || pitchesThisHalf >= MAX_PITCHES_PER_HALF) {
      setPhase('review');
      return;
    }
    const q = pickQuestion();
    if (!q) {
      // 풀이 비었으면 review로 강제 종료
      setPhase('review');
      return;
    }
    setPitchesThisHalf((n) => n + 1);
    audio.pitch();
    if (!isOffense) {
      setPitcherThrew(false);
      window.setTimeout(() => setPitcherThrew(true), 0);
      window.setTimeout(() => setPitcherThrew(false), 500);
    }
    setCurrent({ ...q, startAt: performance.now(), answered: false });
    setLocked(false);
    setPickedAnswer(null);
    setShowAnswerMark(false);
    setBallAnim('');
    setBatterSwung('');

    window.setTimeout(() => {
      setBallAnim(isOffense ? 'throwing-off' : 'throwing-def');
      setTimerBarRunning(false);
      window.setTimeout(() => setTimerBarRunning(true), 0);
    }, 0);

    if (pitchTimeoutRef.current) window.clearTimeout(pitchTimeoutRef.current);
    pitchTimeoutRef.current = window.setTimeout(() => {
      onTimeout();
    }, THROW_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outs, pitchesThisHalf, audio, isOffense, pickQuestion]);

  // ── Outcome handlers ──
  const onTimeout = useCallback(() => {
    if (!current || current.answered) return;
    setCurrent((c) => c ? { ...c, answered: true } : c);
    setLocked(true);
    setShowAnswerMark(true);
    setBallAnim('missed');
    setStreak(0);

    if (isOffense) {
      showCallout('놓쳤다! 아웃', 'out');
      audio.out();
      vibe([100, 50, 100]);
      setBatterSwung('whiff');
      setOuts((o) => o + 1);
      setStats((s) => ({ ...s, totalOut: s.totalOut + 1 }));
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked: null, elapsed: null, result: '아웃', correct: false });
    } else {
      const newBalls = balls + 1;
      setBalls(newBalls);
      showCallout('볼', 'ball');
      audio.ballCall();
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked: null, elapsed: null, result: '볼', correct: false });
      if (newBalls >= 4) {
        const { runs, newBases } = advanceRunners(1);
        setOppScore((s) => s + runs);
        setBases(newBases);
        setBalls(0);
        setStrikes(0);
        setStats((s) => ({ ...s, totalWalk: s.totalWalk + 1 }));
        audio.walk();
        window.setTimeout(() => showCallout('볼넷!' + (runs > 0 ? ` +${runs}실점` : ''), 'out'), 500);
      }
    }
    window.setTimeout(nextPitch, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isOffense, balls, audio, showCallout, advanceRunners]);

  const handleAnswer = (picked: string) => {
    if (locked || !current || current.answered) return;
    if (pitchTimeoutRef.current) window.clearTimeout(pitchTimeoutRef.current);
    setCurrent((c) => c ? { ...c, answered: true } : c);
    setLocked(true);
    setPickedAnswer(picked);
    setShowAnswerMark(true);
    const elapsed = performance.now() - current.startAt;
    const correct = picked === current.answer;
    if (isOffense) handleOffense(picked, correct, elapsed);
    else handleDefense(picked, correct, elapsed);
  };

  const handleOffense = (picked: string, correct: boolean, elapsed: number) => {
    setStats((s) => ({ ...s, totalAnswered: s.totalAnswered + 1 }));
    if (!correct) {
      setStreak(0);
      setBallAnim('missed');
      showCallout('스윙 아웃!', 'out');
      audio.out();
      vibe([100, 50, 100]);
      setBatterSwung('whiff');
      setOuts((o) => o + 1);
      setStats((s) => ({ ...s, totalOut: s.totalOut + 1 }));
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked, elapsed, result: '스윙아웃', correct: false });
      window.setTimeout(nextPitch, 1200);
      return;
    }
    setStreak((n) => n + 1);
    setStats((s) => ({
      ...s,
      totalCorrect: s.totalCorrect + 1,
      fastestMs: s.fastestMs == null || elapsed < s.fastestMs ? elapsed : s.fastestMs,
    }));
    setBatterSwung('swung');

    let basesGained: number, label: string, cls: string, isHR = false;
    if (elapsed < 1200)      { basesGained = 4; label = 'HOMERUN! ⚾'; cls = 'homerun'; isHR = true; }
    else if (elapsed < 2000) { basesGained = 3; label = '3루타!';     cls = 'hit'; }
    else                     { basesGained = 2; label = '2루타!';     cls = 'hit'; }

    setBallAnim(isHR ? 'hit-homerun' : 'hit');
    const { runs, newBases } = advanceRunners(basesGained);
    setBases(newBases);
    setMyScore((s) => s + runs);

    showCallout(label, cls);
    if (isHR) {
      setStats((s) => ({ ...s, totalHR: s.totalHR + 1 }));
      audio.homerun();
      vibe([40, 20, 80, 20, 120]);
      screenFlash();
      burstConfetti();
      showXP(`+${runs * 100} XP · 홈런!`);
    } else {
      audio.batCrack();
      vibe(30);
      if (runs > 0) showXP(`+${runs} 득점!`);
    }
    logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked, elapsed, result: label.replace('!', '').trim() + (runs > 0 ? ` +${runs}` : ''), correct: true });
    window.setTimeout(nextPitch, isHR ? 1600 : 1200);
  };

  const handleDefense = (picked: string, correct: boolean, elapsed: number) => {
    setStats((s) => ({ ...s, totalAnswered: s.totalAnswered + 1 }));
    if (!correct) {
      setStreak(0);
      setBallAnim('hit');
      const { runs, newBases } = advanceRunners(1);
      setBases(newBases);
      setOppScore((s) => s + runs);
      setBalls(0); setStrikes(0);
      showCallout('피안타!' + (runs > 0 ? ` -${runs}` : ''), 'run');
      audio.out();
      vibe([80, 40, 80]);
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked, elapsed, result: '피안타' + (runs > 0 ? ` +${runs}` : ''), correct: false });
      window.setTimeout(nextPitch, 1400);
      return;
    }
    setStreak((n) => n + 1);
    setStats((s) => ({
      ...s,
      totalCorrect: s.totalCorrect + 1,
      fastestMs: s.fastestMs == null || elapsed < s.fastestMs ? elapsed : s.fastestMs,
    }));
    setBallAnim('struck');

    if (elapsed < 1500) {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      showCallout('STRIKE!', 'strike');
      audio.strike();
      vibe(20);
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked, elapsed, result: `K${newStrikes}`, correct: true });
      if (newStrikes >= 3) {
        window.setTimeout(() => showCallout('삼진 아웃! 🔥', 'strike'), 500);
        setOuts((o) => o + 1);
        setStats((s) => ({ ...s, totalK: s.totalK + 1, totalOut: s.totalOut + 1 }));
        audio.homerun();
        vibe([40, 20, 80, 20, 120]);
        setBalls(0); setStrikes(0);
        showXP('+50 XP · 삼진!');
      }
    } else {
      const newBalls = balls + 1;
      setBalls(newBalls);
      showCallout('볼', 'ball');
      audio.ballCall();
      logPlay({ wordId: current!.wordId, word: current!.eng, ko: current!.ko, picked, elapsed, result: `B${newBalls}`, correct: true });
      if (newBalls >= 4) {
        const { runs, newBases } = advanceRunners(1);
        setBases(newBases);
        setOppScore((s) => s + runs);
        setBalls(0); setStrikes(0);
        setStats((s) => ({ ...s, totalWalk: s.totalWalk + 1 }));
        audio.walk();
        window.setTimeout(() => showCallout('볼넷!' + (runs > 0 ? ` -${runs}` : ''), 'out'), 500);
      }
    }
    window.setTimeout(nextPitch, 1200);
  };

  const nextPitch = useCallback(() => {
    throwPitch();
  }, [throwPitch]);

  // ── Fetch all 4 tiers ──
  const loadPools = useCallback(async () => {
    setLoadingPool(true);
    setPoolError(null);
    try {
      const results = await Promise.all(
        TIERS.map((t) => api.getBaseballWords(t)),
      );
      const wordsMap: WordsByTier = { 1: [], 2: [], 3: [], 4: [] };
      const sourceMap: SourceByTier = { 1: 'empty', 2: 'empty', 3: 'empty', 4: 'empty' };
      results.forEach((r, idx) => {
        const t = TIERS[idx];
        wordsMap[t] = r.words;
        sourceMap[t] = r.source;
      });
      setWordsByTier(wordsMap);
      setSourceByTier(sourceMap);
      const playable = TIERS.every((t) => wordsMap[t].length >= 4);
      if (!playable) {
        const firstMsg = results.find((r) => r.message)?.message
          ?? '단어가 부족해요. 선생님께 단어 등록을 부탁하세요.';
        setPoolError(firstMsg);
      }
    } catch (err) {
      setPoolError((err as Error).message || '단어를 불러오지 못했어요.');
    } finally {
      setLoadingPool(false);
    }
  }, []);

  useEffect(() => { loadPools(); }, [loadPools]);

  // ── Lifecycle ──
  const startGame = () => {
    if (poolError) return;
    if (!wordsByTier) return;
    audio.resume();
    audio.click();
    // 새 게임마다 game_id 재생성 — finish 멱등성 키
    gameIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMyScore(0); setOppScore(0);
    setInning(1); setHalf('top');
    setOuts(0); setBalls(0); setStrikes(0);
    setBases([false, false, false]);
    setGameLog([]);
    setPitchesThisHalf(0);
    setStreak(0);
    setStats({ totalHR: 0, totalK: 0, totalWalk: 0, totalOut: 0, totalAnswered: 0, totalCorrect: 0, fastestMs: null });
    setFinishSubmitted(false);
    setPhase('playing');
  };

  // phase=playing 진입 시 첫 투구
  useEffect(() => {
    if (phase === 'playing' && !current) {
      throwPitch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const advanceHalf = () => {
    let nextHalf: Half = half === 'top' ? 'bottom' : 'top';
    let nextInning = inning;
    if (half === 'bottom') nextInning = inning + 1;
    setOuts(0); setBalls(0); setStrikes(0);
    setBases([false, false, false]);
    setPitchesThisHalf(0);
    setStreak(0);
    setCurrent(null);

    if (nextInning > MAX_INNING) {
      setPhase('end');
      return;
    }
    setHalf(nextHalf);
    setInning(nextInning);
    setPhase('playing');
  };

  // outs >= 3 → half 종료
  useEffect(() => {
    if (phase === 'playing' && outs >= 3) {
      if (pitchTimeoutRef.current) window.clearTimeout(pitchTimeoutRef.current);
      setPhase('review');
    }
  }, [outs, phase]);

  // 투구 한도 도달 + 현재 투구 답변 완료 시 half 종료
  useEffect(() => {
    if (phase === 'playing' && pitchesThisHalf >= MAX_PITCHES_PER_HALF && current?.answered) {
      window.setTimeout(() => setPhase('review'), 1300);
    }
  }, [pitchesThisHalf, current?.answered, phase]);

  // ── End: best record + finish API ──
  const bestInfo = useMemo(() => {
    if (phase !== 'end') return null;
    const prev = loadBest();
    const now: BestRecord = {
      myScore, oppScore,
      diff: myScore - oppScore,
      hr: stats.totalHR, k: stats.totalK,
      acc: stats.totalAnswered ? Math.round(stats.totalCorrect / stats.totalAnswered * 100) : 0,
      ts: Date.now(),
    };
    const isWin = now.diff > 0;
    const prevDiff = prev?.diff ?? -Infinity;
    if (isWin && (now.diff > prevDiff || (now.diff === prevDiff && now.hr > (prev?.hr ?? 0)))) {
      saveBest(now);
      return { updated: true, rec: now, prev };
    }
    return { updated: false, rec: now, prev };
  }, [phase, myScore, oppScore, stats]);

  // 게임 종료 시 finish 호출 — wrong_count / review_count 갱신
  useEffect(() => {
    if (phase !== 'end' || finishSubmitted) return;
    const missedIds = Array.from(
      new Set(gameLog.filter((l) => !l.correct && l.wordId).map((l) => l.wordId as string)),
    );
    const correctIds = Array.from(
      new Set(gameLog.filter((l) => l.correct && l.wordId).map((l) => l.wordId as string)),
    );
    if (missedIds.length === 0 && correctIds.length === 0) {
      setFinishSubmitted(true);
      return;
    }
    if (!gameIdRef.current) {
      // gameId 없으면 호출 안 함 (게임이 정상 시작 안 됐다는 뜻)
      setFinishSubmitted(true);
      return;
    }
    api.finishBaseball({ gameId: gameIdRef.current, missedIds, correctIds })
      .catch(() => { /* 통계 누락은 게임 흐름에 영향 X */ })
      .finally(() => setFinishSubmitted(true));
  }, [phase, gameLog, finishSubmitted]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (pitchTimeoutRef.current) window.clearTimeout(pitchTimeoutRef.current);
      if (calloutTimerRef.current) window.clearTimeout(calloutTimerRef.current);
    };
  }, []);

  // ── Keyboard 1-4 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || !current || phase !== 'playing') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) handleAnswer(current.options[n - 1]);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, current, phase]);

  // ── Render helpers ──
  const ballLengthClass = current
    ? current.prompt.length >= 12 ? 'xlong'
    : current.prompt.length >= 8  ? 'long'
    : ''
    : '';
  const ballClass = [
    'ball',
    ballLengthClass,
    ballAnim === 'throwing-off' ? 'throwing off'
    : ballAnim === 'throwing-def' ? 'throwing def'
    : ballAnim,
  ].filter(Boolean).join(' ');

  const exitGame = () => {
    if (phase === 'playing') {
      if (!confirm('게임을 종료하고 홈으로 돌아갈까요?')) return;
    }
    navigate('/');
  };

  // 현재 half 로그 (review용)
  const currentHalfLog = useMemo(
    () => gameLog.filter((l) => l.inning === inning && l.half === half),
    [gameLog, inning, half],
  );

  // 듀얼 구조 라벨
  const poolKindLabel = (t: Tier) => t <= 2 ? '모르는 단어' : '내 단어장';
  const poolSourceBadge = currentSource === 'weak' ? '약점'
    : currentSource === 'my' ? '내 단어'
    : currentSource === 'fallback' ? '전체 단어장(보충)'
    : currentSource === 'empty' ? '단어 부족' : '';

  return (
    <div className="bb-root">
      <div className="bb-inner">
        <button type="button" className="bb-exit" onClick={exitGame} aria-label="홈으로">
          ← HOME
        </button>

        {/* SCOREBOARD */}
        <div className="scoreboard">
          <div className="team-col me">
            <div className="team-label">ME</div>
            <div className="team-score">{myScore}</div>
          </div>
          <div className="inn-col">
            <div className="inn-big">
              <span>{inning}</span>
              <span className="arrow">{isOffense ? '▲' : '▼'}</span>
            </div>
            <div className="inn-label">INNING</div>
          </div>
          <div className="team-col opp">
            <div className="team-label">OPP</div>
            <div className="team-score">{oppScore}</div>
          </div>
        </div>

        {/* STATUS BAR */}
        <div className="statusbar">
          <div className="sb-group">
            <span className="k">OUT</span>
            <div className="pill out">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`dot ${i < outs ? 'on' : ''}`} />
              ))}
            </div>
          </div>
          {!isOffense ? (
            <div className="bs-stack">
              <div className="line">
                <span className="k">B</span>
                <div className="pill ball">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`dot ${i < balls ? 'on' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="line">
                <span className="k">S</span>
                <div className="pill strike">
                  {[0, 1].map((i) => (
                    <span key={i} className={`dot ${i < strikes ? 'on' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          ) : <div />}
          <div className="pitches-left">
            <span>⚾</span>
            <span>{pitchesLeft}</span>
          </div>
        </div>

        {/* HALF BANNER */}
        <div className="half-banner">
          <span className={`role-pill ${isOffense ? 'off' : 'def'}`}>
            {isOffense ? '⚾ 공격' : '🧢 수비'}
          </span>
          <div className="half-center">
            <div className="inn-txt">{inning}회 {isOffense ? '초' : '말'}</div>
            <div className="tier-txt">
              {poolKindLabel(tier)} · {TIER_LABEL[tier]}{poolSourceBadge ? ` · ${poolSourceBadge}` : ''}
            </div>
          </div>
          <div className={`streak ${streak === 0 ? 'dead' : ''}`} title="연속 정답">
            <span>🔥</span><span>{streak}</span>
          </div>
        </div>

        {/* FIELD */}
        <div className={`field ${isOffense ? 'off' : 'def'}`}>
          <div className="diamond" />
          <div className="mound" />
          <div className="base home" />
          <div className={`base first ${bases[0] ? 'on' : ''}`} />
          <div className={`base second ${bases[1] ? 'on' : ''}`} />
          <div className={`base third ${bases[2] ? 'on' : ''}`} />

          <div className={`char batter-me ${batterSwung}`}>
            <svg viewBox="0 0 40 60">
              <rect className="bat" x="27" y="-4" width="4.5" height="30" rx="2" transform="rotate(-25 29 12)" />
              <circle className="body" cx="20" cy="12" r="8" strokeWidth="2" />
              <rect className="body" x="10" y="20" width="20" height="26" rx="4" strokeWidth="2" />
              <rect className="body" x="12" y="44" width="7" height="12" strokeWidth="2" />
              <rect className="body" x="21" y="44" width="7" height="12" strokeWidth="2" />
            </svg>
          </div>
          <div className="char batter-op">
            <svg viewBox="0 0 40 60">
              <rect className="bat" x="27" y="-4" width="4.5" height="30" rx="2" transform="rotate(-25 29 12)" />
              <circle className="body" cx="20" cy="12" r="8" strokeWidth="2" />
              <rect className="body" x="10" y="20" width="20" height="26" rx="4" strokeWidth="2" />
              <rect className="body" x="12" y="44" width="7" height="12" strokeWidth="2" />
              <rect className="body" x="21" y="44" width="7" height="12" strokeWidth="2" />
            </svg>
          </div>
          <div className={`char pitcher-me ${pitcherThrew ? 'threw' : ''}`}>
            <svg viewBox="0 0 40 60">
              <circle className="body" cx="20" cy="12" r="8" strokeWidth="2" />
              <rect className="body" x="10" y="20" width="20" height="26" rx="4" strokeWidth="2" />
              <circle className="glove" cx="6" cy="28" r="5" strokeWidth="2" />
              <rect className="body" x="12" y="44" width="7" height="12" strokeWidth="2" />
              <rect className="body" x="21" y="44" width="7" height="12" strokeWidth="2" />
            </svg>
          </div>
          <div className="char pitcher-op">
            <svg viewBox="0 0 40 60">
              <circle className="body" cx="20" cy="12" r="8" strokeWidth="2" />
              <rect className="body" x="10" y="20" width="20" height="26" rx="4" strokeWidth="2" />
              <circle className="glove" cx="6" cy="28" r="5" strokeWidth="2" />
              <rect className="body" x="12" y="44" width="7" height="12" strokeWidth="2" />
              <rect className="body" x="21" y="44" width="7" height="12" strokeWidth="2" />
            </svg>
          </div>

          <div className="ball-wrap">
            <div className={ballClass}>
              {current?.prompt ?? ''}
            </div>
          </div>
          <div className={`callout ${calloutClass} ${calloutVisible ? 'show' : ''}`} aria-live="polite" role="status">
            {calloutText}
          </div>
        </div>

        {/* HUD */}
        <div className="hud">
          <div className={`question ${isOffense ? 'off' : 'def'}`}>
            <span className="q-hint">
              {isOffense ? '⚾ 공이 날아온다 — 뜻 맞혀 쳐라!' : '🧢 공을 던져라 — 빠를수록 스트라이크!'}
            </span>
            <span className="q-word">{current?.prompt ?? '—'}</span>
            <div className="timer-bar">
              <div
                className="timer-bar-fill"
                style={{
                  transition: timerBarRunning ? `transform ${THROW_MS}ms linear` : 'none',
                  transform: timerBarRunning ? 'scaleX(0)' : 'scaleX(1)',
                }}
              />
            </div>
          </div>
          <div className="choices">
            {current?.options.map((opt, i) => {
              const isCorrect = showAnswerMark && opt === current.answer;
              const isWrong = showAnswerMark && opt === pickedAnswer && opt !== current.answer;
              return (
                <button
                  key={opt + i}
                  type="button"
                  className={`choice ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                  disabled={locked}
                  onClick={() => handleAnswer(opt)}
                >
                  <span className="num">{i + 1}</span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FX */}
      <div className={`bb-flash ${flashOn ? 'go' : ''}`} />
      <div className={`bb-xp-toast ${xpVisible ? 'go' : ''}`}>{xpText}</div>
      <div className="bb-confetti">
        {confettiPieces.map((p, i) => (
          <div
            key={i}
            className="piece"
            style={{
              ['--cx' as any]: p.cx,
              ['--cy' as any]: p.cy,
              ['--cr' as any]: `${p.cr}deg`,
              background: p.color,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* START OVERLAY */}
      {phase === 'start' && (
        <div className="bb-overlay">
          <h1>⚾ WORD BASEBALL</h1>
          <p style={{ color: '#ffc800', fontWeight: 900, letterSpacing: 2, fontSize: 14 }}>
            4 INNINGS · 듀얼 풀 · 공수교대
          </p>
          <div className="rules-grid">
            <div className="rules-card off">
              <h3>📚 1·2회</h3>
              <b>모르는 단어</b><br />
              box ≤ 2 또는<br />
              자주 틀린 단어
            </div>
            <div className="rules-card def">
              <h3>✏️ 3·4회</h3>
              <b>내 단어장</b><br />
              직접 추가한<br />
              단어 위주
            </div>
          </div>
          <div className="rules-grid">
            <div className="rules-card off">
              <h3>⚾ 공격</h3>
              <b>1.2초</b> 홈런<br />
              <b>2.0초</b> 3루타<br />
              <b>2.8초</b> 2루타<br />
              오답·놓침 = 아웃
            </div>
            <div className="rules-card def">
              <h3>🧢 수비</h3>
              정답 <b>&lt;1.5초</b> 스트라이크<br />
              정답 <b>≥1.5초</b> 볼<br />
              오답 = 피안타<br />
              3K=삼진 / 4B=볼넷
            </div>
          </div>
          {loadingPool && <p>단어 불러오는 중...</p>}
          {!loadingPool && poolError && (
            <>
              <p style={{ color: '#ff4b4b' }}>{poolError}</p>
              <button onClick={loadPools}>다시 시도</button>
            </>
          )}
          {!loadingPool && !poolError && wordsByTier && (
            <>
              <p style={{ fontSize: 12, color: '#b8d4c4' }}>
                준비된 단어 · 1회 {wordsByTier[1].length} · 2회 {wordsByTier[2].length} · 3회 {wordsByTier[3].length} · 4회 {wordsByTier[4].length}
              </p>
              <button onClick={startGame}>PLAY BALL! ⚾</button>
            </>
          )}
        </div>
      )}

      {/* REVIEW OVERLAY */}
      {phase === 'review' && (
        <ReviewOverlay
          inning={inning}
          half={half}
          myScore={myScore}
          oppScore={oppScore}
          logs={currentHalfLog}
          onNext={advanceHalf}
        />
      )}

      {/* END OVERLAY */}
      {phase === 'end' && bestInfo && (
        <EndOverlay
          myScore={myScore}
          oppScore={oppScore}
          stats={stats}
          bestInfo={bestInfo}
          onRestart={startGame}
        />
      )}
    </div>
  );
}

// ===== Review overlay =====
function ReviewOverlay({
  inning, half, myScore, oppScore, logs, onNext,
}: {
  inning: number;
  half: Half;
  myScore: number;
  oppScore: number;
  logs: PlayLog[];
  onNext: () => void;
}) {
  const halfLabel = half === 'top' ? '초' : '말';
  const role = half === 'top' ? '⚾ 공격' : '🧢 수비';
  const answered = logs.filter((l) => l.elapsed !== null);
  const corrects = logs.filter((l) => l.correct).length;
  const avgMs = answered.length ? answered.reduce((s, l) => s + (l.elapsed || 0), 0) / answered.length : 0;
  return (
    <div className="bb-overlay">
      <h2>{inning}회 {halfLabel} 종료 · {role}</h2>
      <div className="review-score-row">
        <div className="side-me">
          <div className="team-label">ME</div>
          <div className="big">{myScore}</div>
        </div>
        <div className="vs-badge">VS</div>
        <div className="side-opp">
          <div className="team-label">OPP</div>
          <div className="big">{oppScore}</div>
        </div>
      </div>
      <div className="review-stats">
        <div className="stat-card">
          <span className="v">{answered.length ? (avgMs / 1000).toFixed(1) + 's' : '—'}</span>
          <span className="l">평균 반응</span>
        </div>
        <div className="stat-card">
          <span className="v">{logs.length ? Math.round(corrects / logs.length * 100) + '%' : '—'}</span>
          <span className="l">정답률</span>
        </div>
        <div className="stat-card">
          <span className="v">{logs.length}</span>
          <span className="l">타석</span>
        </div>
      </div>
      <div className="review-list">
        {logs.length === 0 ? (
          <div className="row" style={{ gridTemplateColumns: '1fr', textAlign: 'center', color: '#b8d4c4' }}>
            기록 없음
          </div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className={`row ${l.correct ? '' : 'bad'}`}>
              <span className={`mark ${l.correct ? 'ok' : 'bad'}`}>{l.correct ? '✓' : '✗'}</span>
              <span className="w-en">{l.word}<small>{l.ko}</small></span>
              <span className="w-time">{l.elapsed !== null ? (l.elapsed / 1000).toFixed(1) + 's' : '—'}</span>
              <span className="w-result">{l.result}</span>
            </div>
          ))
        )}
      </div>
      <button onClick={onNext}>다음 ▶</button>
    </div>
  );
}

// ===== End overlay =====
function EndOverlay({
  myScore, oppScore, stats, bestInfo, onRestart,
}: {
  myScore: number;
  oppScore: number;
  stats: Stats;
  bestInfo: { updated: boolean; rec: BestRecord; prev: BestRecord | null };
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  let title: string, msg: string;
  if (myScore > oppScore) {
    title = '🏆 WIN!';
    msg = `멋진 경기! ${myScore - oppScore}점 차 승리 🎉`;
  } else if (myScore < oppScore) {
    title = '😢 LOSE';
    msg = `아쉽다... ${oppScore - myScore}점 차 패배. 다시 도전!`;
  } else {
    title = '🤝 TIE';
    msg = '무승부! 아슬아슬한 경기였어';
  }
  const acc = stats.totalAnswered ? Math.round(stats.totalCorrect / stats.totalAnswered * 100) : 0;
  const fastest = stats.fastestMs != null ? (stats.fastestMs / 1000).toFixed(2) + 's' : '—';
  const bestText = bestInfo.updated
    ? `🌟 NEW BEST! ${bestInfo.rec.myScore}:${bestInfo.rec.oppScore} (+${bestInfo.rec.diff}) · HR ${bestInfo.rec.hr}`
    : bestInfo.prev
    ? `역대 최고: ${bestInfo.prev.myScore}:${bestInfo.prev.oppScore} (+${bestInfo.prev.diff}) · HR ${bestInfo.prev.hr}`
    : '';
  return (
    <div className="bb-overlay">
      <h1>{title}</h1>
      <div className="big-score">
        <span className="me">{myScore}</span>
        <span className="sep">:</span>
        <span className="opp">{oppScore}</span>
      </div>
      <div className="review-stats">
        <div className="stat-card">
          <span className="v">{stats.totalHR}</span>
          <span className="l">홈런</span>
        </div>
        <div className="stat-card">
          <span className="v">{stats.totalK}</span>
          <span className="l">삼진</span>
        </div>
        <div className="stat-card">
          <span className="v">{stats.totalWalk}</span>
          <span className="l">볼넷</span>
        </div>
      </div>
      <div className="review-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <span className="v">{acc}%</span>
          <span className="l">정답률 ({stats.totalCorrect}/{stats.totalAnswered})</span>
        </div>
        <div className="stat-card">
          <span className="v">{fastest}</span>
          <span className="l">최고 반응속도</span>
        </div>
      </div>
      {bestText && <div className="best-box">{bestText}</div>}
      <p>{msg}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRestart}>다시 플레이 🔄</button>
        <button onClick={() => navigate('/')} style={{ background: '#1cb0f6', boxShadow: '0 6px 0 #0d8dc7, 0 6px 0 #041209' }}>
          홈으로 🏠
        </button>
      </div>
    </div>
  );
}
