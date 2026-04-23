// me — trainer card + weekly graph

export const EXP_PER_LEVEL = 100;

function addDays(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function weeklyGraph(history, today) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
  const buckets = new Map(days.map(d => [d, { date: d, correct: 0, total: 0 }]));
  for (const h of history) {
    const b = buckets.get(h.date);
    if (!b) continue;
    b.correct += h.correct ?? 0;
    b.total += h.total ?? 0;
  }
  return [...buckets.values()].map(b => ({ ...b, ratio: b.total ? b.correct / b.total : 0 }));
}

export function levelFromExp(exp) {
  const lv = Math.max(1, Math.floor(exp / EXP_PER_LEVEL) + 1);
  const intoLevel = exp - (lv - 1) * EXP_PER_LEVEL;
  return { lv, intoLevel, toNext: EXP_PER_LEVEL };
}

export function trainerCard({ profile, words, history, seen, today }) {
  const bars = weeklyGraph(history, today);
  const weekSessions = history.filter(h => bars.some(b => b.date === h.date)).length;
  const sumCorrect = bars.reduce((s, b) => s + b.correct, 0);
  const sumTotal = bars.reduce((s, b) => s + b.total, 0);
  const level = levelFromExp(profile.exp ?? 0);
  const seenSet = new Set(seen);
  return {
    lv: profile.lv ?? level.lv,
    expIntoLevel: level.intoLevel,
    expToNext: level.toNext,
    coin: profile.coin ?? 0,
    streak: profile.streak ?? 0,
    lastActiveDate: profile.lastActiveDate ?? null,
    totalWords: words.length,
    dexCount: [...seenSet].filter(id => words.some(w => w.id === id)).length,
    weekSessions,
    weekAccuracy: sumTotal ? sumCorrect / sumTotal : 0,
    weeklyBars: bars,
  };
}
