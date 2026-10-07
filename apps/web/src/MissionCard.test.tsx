import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveMission } from '@sidequest/contracts';
import { MissionCard } from './MissionCard';

const mission: ActiveMission = {
  id: '4f953d1e-d50d-4f1d-a5ed-7c02710e91cd', title: 'Operation Secret Base', premise: 'Your team has 45 minutes to find a secret base before returning home.', difficulty: 2, durationMinutes: 45,
  objectives: ['Pick your role.', 'Find a clue.', 'Spot a shield.', 'Choose a safe spot as your secret base.', 'Name your quest.'], bonus: 'Find something nobody else notices.',
  memoryMoment: { text: 'At your secret base, make a victory pose and take a photo.', objectiveIndex: 4, sceneAnchor: 'secret base' }, type: 'treasure',
  participants: [{ id: 'a256eb7b-32c8-4949-a839-0130e12bc380', name: 'Moni', level: 4 }],
  setup: { participantIds: ['a256eb7b-32c8-4949-a839-0130e12bc380'], blocker: 'kids-reluctant', timeBudget: '1h', distance: 'walk' },
  baseXp: 350, createdAt: '2026-10-07T12:00:00.000Z',
};

describe('mission card', () => {
  it('contains every field needed away from the computer and no navigation controls', () => {
    const html = renderToStaticMarkup(<MissionCard mission={mission} />);
    expect(html).toContain('Operation Secret Base');
    expect(html).toContain('Moni');
    expect(html).toContain('Choose a safe spot as your secret base.');
    expect(html).toContain('victory pose');
    expect(html).toContain('MAIN OBJECTIVE');
    expect(html).toContain('350 XP');
    expect((html.match(/paper-checkbox/g) ?? [])).toHaveLength(7);
    expect(html).not.toContain('button');
  });
});
