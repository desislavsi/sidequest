import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@sidequest/contracts';
import { baseXpFor, chooseMissionType, familyStreak, levelProgress, unlockedTypes } from './progression.js';

const entry = (date: string, type: HistoryEntry['type'] = 'basic'): HistoryEntry => ({
  id: crypto.randomUUID(), title: 'A quest', date, participants: ['Moni'], type, xp: 200, rating: 'great',
});

describe('progression', () => {
  it('carries XP through level boundaries and unlocks the intended ranks', () => {
    expect(levelProgress(2600)).toMatchObject({ level: 4, rank: 'Explorer', progressXp: 800, nextLevelXp: 1000 });
    expect(levelProgress(2950)).toMatchObject({ level: 5, rank: 'Adventurer', progressXp: 150 });
    expect(unlockedTypes(7)).toEqual(['basic', 'treasure', 'adventure', 'mystery']);
    expect(baseXpFor('1h')).toBe(350);
  });

  it('prioritizes the highest new unlock and then less recent types', () => {
    expect(chooseMissionType(5, [entry('2026-10-06', 'treasure')])).toBe('adventure');
    expect(chooseMissionType(4, [entry('2026-10-06', 'treasure')])).toBe('basic');
  });

  it('counts one completion per local day, including yesterday, and resets after a gap', () => {
    const history = [entry('2026-10-04'), entry('2026-10-05'), entry('2026-10-05'), entry('2026-10-06')];
    expect(familyStreak(history, new Date(2026, 9, 6))).toBe(3);
    expect(familyStreak(history, new Date(2026, 9, 7))).toBe(3);
    expect(familyStreak(history, new Date(2026, 9, 8))).toBe(0);
  });
});
