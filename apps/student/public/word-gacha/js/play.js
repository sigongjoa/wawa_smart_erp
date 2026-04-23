// play — interactions in the playroom. Pure functions.
// All actions take a creature + now, return { creature, reward, speech, error? }.

import { interact, BOND_MAX, HUNGER_MAX, moodOf } from './creature.js';

// When feeding is rejected as "full" (UI also uses this threshold to disable button).
export const FEED_FULL = 70;

// Cooldowns (ms). tap is a creature.js concern but we keep its gate here for UI parity.
export const COOLDOWNS = {
  tap:   3_000,
  feed:  0,
  pet:   30_000,
  ball:  300_000,
  sleep: 86_400_000, // once a day
};

const MS = { sec: 1000 };

export function canDo(kind, lastAt, now) {
  if (!(kind in COOLDOWNS)) return false;
  if (!lastAt) return true;
  const elapsed = new Date(now) - new Date(lastAt);
  return elapsed >= COOLDOWNS[kind];
}

export function remainingMs(kind, lastAt, now) {
  if (!lastAt) return 0;
  const elapsed = new Date(now) - new Date(lastAt);
  return Math.max(0, COOLDOWNS[kind] - elapsed);
}

// moodSpeech — pool per mood (generic, personality-agnostic).
const SPEECH = {
  thriving:['완전 최고야!', '오늘 너무 행복해!', '같이 있으니 좋아~'],
  happy:   ['오늘도 같이 놀자!', '재밌어!', '좋아 좋아~'],
  content: ['기분 괜찮아', '편안해~', '조용히 있자'],
  neutral: ['안녕!', '뭐하고 놀까?', '음…'],
  bored:   ['심심해…', '뭐 할까?', '같이 놀자'],
  hungry:  ['배고파…', '뭐 먹을 거 있어?', '밥 줘~'],
  sad:     ['어디 갔었어?', '보고 싶었어', '다시 왔구나…'],
};
export function speechFor(mood, seed = 0) {
  const pool = SPEECH[mood] ?? SPEECH.neutral;
  return pool[seed % pool.length];
}

// Personality-flavored lines for specific events (override when matched).
// Events: correct, wrong, addWord, reunion, feed, pet, levelUp.
// Falls back to generic `speechFor(mood)` when no personality line exists.
export const PERSONALITY_LINES = {
  brave: {
    correct: ['그치! 당연하지!', '멋지잖아!'],
    wrong:   ['괜찮아, 다음이지!', '에잇, 아까워!'],
    feed:    ['한 입에 끝!'],
    pet:     ['계속 해줘!'],
    reunion: ['기다렸다구!'],
    addWord: ['새 단어다!'],
    levelUp: ['더 강해졌어!'],
  },
  gentle: {
    correct: ['잘했어~', '고마워…'],
    wrong:   ['괜찮아, 천천히', '다시 해볼까?'],
    feed:    ['맛있어… 고마워'],
    pet:     ['부드러워…'],
    reunion: ['보고 싶었어…'],
    addWord: ['같이 외우자~'],
    levelUp: ['조금씩 자랄게'],
  },
  curious: {
    correct: ['오! 그거구나?!', '신기해!'],
    wrong:   ['이건 뭐지?', '음… 어렵네'],
    feed:    ['이거 뭐야?!'],
    pet:     ['간지러워 ㅎㅎ'],
    reunion: ['오늘 뭐 새로워?'],
    addWord: ['새로운 단어! 알려줘!'],
    levelUp: ['뭐가 달라진거야?!'],
  },
  lazy: {
    correct: ['응~ 뭐…', '그렇지~'],
    wrong:   ['흠… 낮잠이나…', '괜찮아~'],
    feed:    ['음냐… 맛있다'],
    pet:     ['조금만 더…'],
    reunion: ['왔구나~ 자던 중이야'],
    addWord: ['단어 또 왔어?'],
    levelUp: ['귀찮아… 하지만 뿌듯'],
  },
};

export function lineFor(personality, event, mood, seed = 0) {
  const pack = PERSONALITY_LINES[personality];
  const pool = pack && pack[event];
  if (pool && pool.length) return pool[Math.abs(seed) % pool.length];
  return speechFor(mood, seed);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function performAction(creature, kind, now) {
  if (!creature) return { error: 'no creature' };
  switch (kind) {
    case 'tap': {
      const next = interact(creature, 'tap', now);
      return { creature: next, reward: { bond: 0.5 }, speech: speechFor(next.mood, Date.now()) };
    }
    case 'feed': {
      if ((creature.hunger ?? HUNGER_MAX) >= FEED_FULL) {
        return { error: 'not hungry', speech: '배 안 고파!' };
      }
      const next = {
        ...creature,
        hunger: clamp((creature.hunger ?? 0) + 30, 0, HUNGER_MAX),
        bond:   clamp((creature.bond ?? 0) + 1, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { hunger: 30, bond: 1 }, speech: '맛있어!' };
    }
    case 'pet': {
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 3, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 3 }, speech: '쓰담쓰담 좋아~' };
    }
    case 'ball': {
      // bond +2 on correct answer (caller decides); baseline +0.5 for playing.
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 0.5, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 0.5 }, speech: '공이다!' };
    }
    case 'ball:correct': {
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 2, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 2, exp: 5 }, speech: '정답!' };
    }
    case 'sleep': {
      // restores mood baseline, does not change bond
      const next = { ...creature, mood: 'happy', lastInteractionAt: now };
      return { creature: next, reward: {}, speech: 'zZz…' };
    }
    default:
      return { error: 'unknown action' };
  }
}
