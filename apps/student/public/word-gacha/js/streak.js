// streak + badges + coin rewards

export const COIN_PER_CORRECT = 2;

export const BADGE_MILESTONES = [
  { id: 'streak-7',  type: 'streak', threshold: 7,  label: '7일 연속' },
  { id: 'streak-14', type: 'streak', threshold: 14, label: '2주 연속' },
  { id: 'streak-30', type: 'streak', threshold: 30, label: '한 달 연속' },
];

function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export function updateStreak(profile, today) {
  if (!profile.lastActiveDate) {
    return { ...profile, streak: 1, lastActiveDate: today };
  }
  const gap = diffDays(profile.lastActiveDate, today);
  if (gap === 0) return { ...profile };
  if (gap === 1) return { ...profile, streak: (profile.streak ?? 0) + 1, lastActiveDate: today };
  return { ...profile, streak: 1, lastActiveDate: today };
}

export function checkBadges(profile, earnedBadges = []) {
  const earnedIds = new Set(earnedBadges.map(b => b.id));
  const today = new Date().toISOString().slice(0, 10);
  const newBadges = [];
  for (const m of BADGE_MILESTONES) {
    if (m.type === 'streak' && (profile.streak ?? 0) >= m.threshold && !earnedIds.has(m.id)) {
      newBadges.push({ id: m.id, earnedAt: today, label: m.label });
    }
  }
  return { newBadges, badges: [...earnedBadges, ...newBadges] };
}

export function grantCoins(profile, correctCount) {
  return { ...profile, coin: (profile.coin ?? 0) + correctCount * COIN_PER_CORRECT };
}
