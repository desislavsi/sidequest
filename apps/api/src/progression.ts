import type { Blocker, HistoryEntry, MissionType, TimeBudget } from './types.js';

const ranks = [
  { level: 1, rank: 'Rookie', type: 'basic' },
  { level: 3, rank: 'Explorer', type: 'treasure' },
  { level: 5, rank: 'Adventurer', type: 'adventure' },
  { level: 7, rank: 'Detective', type: 'mystery' },
  { level: 10, rank: 'Quest Master', type: 'epic' },
] as const;

export function levelProgress(totalXp: number) {
  let level = 1;
  let progressXp = totalXp;
  while (progressXp >= 200 * (level + 1)) {
    progressXp -= 200 * (level + 1);
    level += 1;
  }
  const rank = [...ranks].reverse().find((item) => level >= item.level)!.rank;
  return { level, rank, progressXp, nextLevelXp: 200 * (level + 1) };
}

export function unlockedTypes(level: number): MissionType[] {
  return ranks.filter((item) => level >= item.level).map((item) => item.type);
}

export function chooseMissionType(level: number, history: HistoryEntry[]): MissionType {
  const available = unlockedTypes(level).reverse();
  const types = history.map((item) => item.type);
  const recent = types.slice(-3);
  return available.find((type) => !recent.includes(type)) ?? available.reduce((best, type) => {
    const last = types.lastIndexOf(type);
    const bestLast = types.lastIndexOf(best);
    return last < bestLast ? type : best;
  });
}

export const baseXpFor = (budget: TimeBudget) => ({ '30m': 200, '1h': 350, '2h+': 500 })[budget];

export const blockerStrategies: Record<Blocker, { strategy: string; instruction: string }> = {
  'kids-reluctant': { strategy: 'playful-start', instruction: 'Start with an easy, playful first objective that gives reluctant children a role or choice immediately.' },
  tired: { strategy: 'low-effort', instruction: 'Use low exertion, minimal walking and few stops; no running, races or strenuous tasks.' },
  'short-time': { strategy: 'compact-route', instruction: 'Keep all objectives on a compact route close to the starting point and finish inside the time budget.' },
  'bad-weather': { strategy: 'weather-ready', instruction: 'Use sheltered spots or brief outdoor exposure. Do not rely on sunshine or claim to know current weather.' },
  bored: { strategy: 'novel-twist', instruction: 'Give familiar surroundings a surprising game rule, story or role; avoid a generic scavenger hunt.' },
  surprise: { strategy: 'open-surprise', instruction: 'Create a distinctive, accessible quest with a surprising but practical twist.' },
};

export function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dayNumber(date: string): number { return Date.parse(`${date}T00:00:00Z`) / 86_400_000; }

export function familyStreak(history: HistoryEntry[], now: Date): number {
  const days = [...new Set(history.map((item) => item.date))].sort().reverse();
  if (!days.length) return 0;
  const today = dayNumber(localDateKey(now));
  if (today - dayNumber(days[0]) > 1) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (dayNumber(days[i - 1]) - dayNumber(days[i]) !== 1) break;
    streak++;
  }
  return streak;
}
