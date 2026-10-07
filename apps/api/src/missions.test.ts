import { describe, expect, it } from 'vitest';
import type { MissionDraft } from '@sidequest/contracts';
import { exampleProfiles } from './repository.js';
import { blockerStrategies } from './progression.js';
import { generateMission, selectMissionInterests, validateMissionDraft, type MissionContext, type MissionModel } from './missions.js';
import { questPlanFor, questPlanOptionsFor } from './quest-plans.js';

const context = (blocker: MissionContext['setup']['blocker'] = 'kids-reluctant', count = 0): MissionContext => ({
  setup: { participantIds: exampleProfiles.map((person) => person.id), blocker, timeBudget: '1h', distance: 'walk' },
  participants: exampleProfiles, type: 'treasure', recentHistory: [], completedMissionCount: count,
});

const starts: Record<MissionContext['setup']['blocker'], string> = {
  'kids-reluctant': 'Pick a pretend animal to rescue.',
  tired: 'Pick a pretend animal to rescue close by.',
  'short-time': 'Pick a pretend animal to rescue near home.',
  'bad-weather': 'Pick a pretend animal for a short outdoor search.',
  bored: 'Pick a silly pretend animal to rescue.',
  surprise: 'Pick a pretend animal to rescue.',
};
function generated(blocker: MissionContext['setup']['blocker'] = 'kids-reluctant') {
  return {
    title: 'Animal Home Detectives', planChoice: 0, premise: 'Find clues to a pretend animal home.',
    objectives: [starts[blocker], 'Spot three shapes like animal tracks.', 'Find two places a small animal could hide.', 'Choose one nook as your animal hideout.', 'Solve which animal could live in your hideout.'],
    bonus: 'Find one more animal clue nearby.',
    photo: { sceneAnchor: 'animal hideout', objectiveIndex: 4, text: 'At your animal hideout, pose like its animal and take a photo.' },
  };
}
function fullDraft(blocker: MissionContext['setup']['blocker'] = 'kids-reluctant'): MissionDraft {
  const sample = generated(blocker);
  return {
    title: sample.title, premise: sample.premise, objectives: sample.objectives, bonus: sample.bonus,
    difficulty: 2, durationMinutes: 50,
    memoryMoment: { ...sample.photo },
    blockerAdaptation: { strategy: blockerStrategies[blocker].strategy as MissionDraft['blockerAdaptation']['strategy'], objectiveIndex: 1, explanation: 'The first step adapts to the blocker.' },
    interestHook: { participantId: exampleProfiles[1].id, interest: 'Animals', objectiveIndex: 1, explanation: 'Animal rescue shapes the quest.' },
  };
}

describe('mission quality gates', () => {
  it('features children before adults and rotates children and their interests', () => {
    expect(selectMissionInterests(context('kids-reluctant', 0)).featured).toMatchObject({ name: 'Georgi', interest: 'Animals' });
    expect(selectMissionInterests(context('kids-reluctant', 1)).featured).toMatchObject({ name: 'Moni', interest: 'Gaming' });
    expect(selectMissionInterests(context('kids-reluctant', 2)).featured).toMatchObject({ name: 'Georgi', interest: 'Building' });
    expect(selectMissionInterests(context('kids-reluctant', 3)).featured).toMatchObject({ name: 'Moni', interest: 'Football' });
    const adultsOnly = { ...context(), participants: [exampleProfiles[2]] };
    expect(selectMissionInterests(adultsOnly).featured?.interest).toBe('Photography');
  });

  it.each(Object.keys(blockerStrategies) as MissionContext['setup']['blocker'][])("requires visible adaptation for '%s'", (blocker) => {
    expect(validateMissionDraft(fullDraft(blocker), context(blocker)).objectives).toHaveLength(5);
    if (blocker !== 'surprise') {
      const wrong = { ...fullDraft(blocker), blockerAdaptation: { ...fullDraft(blocker).blockerAdaptation, strategy: 'open-surprise' } };
      expect(() => validateMissionDraft(wrong, context(blocker))).toThrow('blocker strategy');
    }
  });

  it.each(Object.keys(blockerStrategies) as MissionContext['setup']['blocker'][])("builds an interest plan for '%s'", async (blocker) => {
    const mission = await generateMission({ draft: async () => ({ title: 'Animal Clue Hunt', planChoice: 0 }) }, context(blocker));
    expect(mission.blockerAdaptation.strategy).toBe(blockerStrategies[blocker].strategy);
    expect(mission.objectives[0]).toMatch(/^Pick /);
    expect(mission.premise).toContain('pretend animal clues');
  });

  it('keeps bad-weather missions independent of live weather and tired missions gentle', () => {
    expect(() => validateMissionDraft({ ...fullDraft('bad-weather'), premise: 'Today is sunny outside.' }, context('bad-weather'))).toThrow('current weather');
    const tired = fullDraft('tired');
    expect(() => validateMissionDraft({ ...tired, objectives: [tired.objectives[0], 'Jump to your next clue.', ...tired.objectives.slice(2)] }, context('tired'))).toThrow('strenuous');
  });

  it('rejects filler, generic spot quests, and interest as decoration', () => {
    const base = fullDraft();
    expect(() => validateMissionDraft({ ...base, objectives: ['Choose your animal team name.', ...base.objectives.slice(1)] }, context())).toThrow('filler');
    expect(() => validateMissionDraft({ ...base, title: 'The Best Game Stop Hunt' }, context())).toThrow('filler');
    const incidental = { ...base, objectives: [base.objectives[0], 'Spot three round rocks.', 'Find two places a fox could hide.', 'Choose one nook as your fox hideout.', 'Solve which fox could live in your hideout.'], memoryMoment: { ...base.memoryMoment, sceneAnchor: 'fox hideout', text: 'At your fox hideout, pose like a fox and take a photo.' } };
    expect(() => validateMissionDraft(incidental, context())).toThrow('interest must drive');
    expect(() => validateMissionDraft({ ...base, objectives: [base.objectives[0], 'Talk about a rock.', 'Choose a rock.', ...base.objectives.slice(3)] }, context())).toThrow();
  });

  it('rejects complex, long, or multi-action steps instead of cutting them', () => {
    const base = fullDraft();
    expect(() => validateMissionDraft({ ...base, objectives: ['Determine the primary habitat of a camouflaged animal.', ...base.objectives.slice(1)] }, context())).toThrow('too complex');
    expect(() => validateMissionDraft({ ...base, objectives: ['Choose your animal role and find three clues.', ...base.objectives.slice(1)] }, context())).toThrow('more than one action');
    expect(() => validateMissionDraft({ ...base, objectives: ['Choose the funniest animal you can possibly think of before you even leave your house.', ...base.objectives.slice(1)] }, context())).toThrow('short');
  });

  it('requires a discovered photo scene and an action specific to the quest', () => {
    const base = fullDraft();
    expect(() => validateMissionDraft({ ...base, objectives: [...base.objectives.slice(0, 3), 'Tell a story about your animal hideout.', base.objectives[4]] }, context())).toThrow('choose or find');
    expect(() => validateMissionDraft({ ...base, objectives: ['Choose your animal hideout.', ...base.objectives.slice(1)] }, context())).toThrow('before it is established');
    expect(() => validateMissionDraft({ ...base, memoryMoment: { ...base.memoryMoment, sceneAnchor: 'game stop' } }, context())).toThrow('concrete scene');
    expect(() => validateMissionDraft({ ...base, memoryMoment: { ...base.memoryMoment, text: 'At your animal hideout, pose together and take a photo.' } }, context())).toThrow('mission-specific');
  });

  it('rejects invented rewards, unsafe actions, and branded text', () => {
    const base = fullDraft();
    expect(() => validateMissionDraft({ ...base, bonus: 'Name 50 XP clues.' }, context())).toThrow('reward rules');
    expect(() => validateMissionDraft({ ...base, objectives: [base.objectives[0], 'Cross a road.', ...base.objectives.slice(2)] }, context())).toThrow('unsafe');
    expect(() => validateMissionDraft({ ...base, title: 'Spider-Man Animal Quest' }, context())).toThrow('copyrighted');
    expect(() => validateMissionDraft({ ...base, premise: 'Build an animal hideout outside.' }, context())).toThrow('builds or moves');
  });

  it('uses one model call for the title and a connected interest-driven plan', async () => {
    let calls = 0;
    const model: MissionModel = { draft: async () => { calls++; return generated(); } };
    const result = await generateMission(model, context());
    expect(calls).toBe(1);
    expect(result.objectives).toEqual([
      'Pick a silly pretend animal to help.', 'Spot three shapes like animal tracks.',
      'Find two places a small animal could hide.', 'Choose one of those places as your animal hideout.',
      'Solve which animal could live in the hideout.',
    ]);
    expect(result.memoryMoment.sceneAnchor).toBe('animal hideout');
    expect(result.premise).toBe('Follow pretend animal clues to choose a hideout for your imaginary visitor.');
    expect(result.interestHook).toMatchObject({ participantId: exampleProfiles[1].id, interest: 'Animals' });
  });

  it('lets the local model choose a different validated plan with different tasks and photo scene', async () => {
    const selected = await generateMission({ draft: async () => ({ title: 'Animal Parade', planChoice: 1 }) }, context());
    expect(selected.objectives[1]).toBe('Find three shapes that look like animal features.');
    expect(selected.memoryMoment.sceneAnchor).toBe('parade finish');
    expect(selected.title).toBe('Animal Parade');
  });

  it('repairs a plan choice that is unavailable for a single-plan interest', async () => {
    let calls = 0;
    const child = { ...exampleProfiles[1], interests: ['Building'] };
    const buildingContext = { ...context(), participants: [child], setup: { ...context().setup, participantIds: [child.id] } };
    const selected = await generateMission({ draft: async () => ({ title: 'Tiny Town', planChoice: ++calls === 1 ? 1 : 0 }) }, buildingContext);
    expect(calls).toBe(2);
    expect(selected.premise).toContain('tiny pretend town');
  });

  it('requires the model to return an explicit plan choice', async () => {
    await expect(generateMission({ draft: async () => ({ title: 'Animal Parade' }) }, context())).rejects.toThrow('after two attempts');
  });

  it('does not let model filler replace playable tasks or the linked photo', async () => {
    const sample = {
      title: 'Animal Detectives Quest', planChoice: 0, premise: 'Build a hideout using real animal tracks.',
      objectives: ['Choose a funny pretend animal partner for our mission.', 'Find three shapes in the ground like small creature tracks.', 'Spot two good spots where a little animal might rest.', 'Pick one safe nook to be your animal hideout.', 'Guess what animal could live in your chosen hideout.'],
      bonus: "Make your animal partner give a little power-up wiggle!",
      photo: { sceneAnchor: 'animal hideout', objectiveIndex: 4, text: 'At the animal hideout, take a photo posing as your guessed animal.' },
    };
    const result = await generateMission({ draft: async () => sample }, context());
    expect(result.objectives).not.toEqual(sample.objectives);
    expect(result.memoryMoment.text).toBe('At your animal hideout, pose as that animal and take a photo.');
    expect(result.premise).not.toBe(sample.premise);
  });

  it('rotates gaming challenges when that child and interest come around again', async () => {
    const model: MissionModel = { draft: async () => ({ title: 'Power-Up Quest', planChoice: 0, premise: 'Find power-ups to beat three outdoor levels.' }) };
    const first = await generateMission(model, context('kids-reluctant', 1));
    const next = await generateMission(model, context('kids-reluctant', 7));
    expect(first.objectives[1]).toContain('red things');
    expect(next.objectives[1]).toContain('recharge your robot');
    expect(first.memoryMoment.sceneAnchor).toBe('final power-up');
    expect(next.memoryMoment.sceneAnchor).toBe('final power-up station');
  });

  it('avoids a recently boring challenge when another plan is available', () => {
    expect(questPlanFor('power-up', 7, 2).title).toBe('Robot Training');
    expect(questPlanFor('power-up', 7, 2, [{ title: 'Robot Training', rating: 'boring' }]).title).toBe('Power-Up Hunt');
    expect(questPlanOptionsFor('power-up', 7, 2, [{ title: 'Robot Training', rating: 'boring' }]).map((plan) => plan.title)).toEqual(['Power-Up Hunt']);
  });

  it('changes the gaming challenge when Adventure unlocks', async () => {
    const model: MissionModel = { draft: async () => ({ title: 'Power-Up Quest', planChoice: 0 }) };
    const treasure = await generateMission(model, context('kids-reluctant', 1));
    const adventure = await generateMission(model, { ...context('kids-reluctant', 1), type: 'adventure' });
    expect(treasure.objectives[1]).toContain('red things');
    expect(adventure.objectives[1]).toContain('robot power-ups');
  });

  it.each([
    [3, 9, 'goal'], [4, 10, 'code'], [5, 11, 'clue'],
  ])('rotates another seeded interest between missions %i and %i', async (firstCount, nextCount, motif) => {
    const model: MissionModel = { draft: async () => ({ title: `${motif} Mission`, planChoice: 0 }) };
    const first = await generateMission(model, context('kids-reluctant', firstCount));
    const next = await generateMission(model, context('kids-reluctant', nextCount));
    expect(first.objectives).not.toEqual(next.objectives);
  });

  it('removes title hype and a subtitle without changing the challenge', async () => {
    const mission = await generateMission({ draft: async () => ({ title: 'The Amazing Animal Clue Hunt: Best Ever', planChoice: 0 }) }, context());
    expect(mission.title).toBe('Animal Clue Hunt');
  });

  it.each([
    [0, 'animal'], [1, 'power-up'], [2, 'shape'], [3, 'goal'], [4, 'code'], [5, 'clue'],
  ])('keeps seeded interest plan %i playable', async (count, motif) => {
    const model: MissionModel = { draft: async () => ({ title: `${motif} Quest`, planChoice: 0, premise: `Find ${motif} clues outside.` }) };
    const mission = await generateMission(model, context('kids-reluctant', count));
    expect(mission.objectives).toHaveLength(5);
    expect(mission.objectives.filter((step) => step.toLowerCase().includes(motif)).length).toBeGreaterThanOrEqual(2);
    expect(mission.memoryMoment.text).toContain(mission.memoryMoment.sceneAnchor);
  });

  it('validates every current quest plan and its rotated variant', async () => {
    const cases = [
      ['Animals', 'animal'], ['Gaming', 'power-up'], ['Football', 'goal'], ['Building', 'shape'],
      ['Puzzles', 'code'], ['Exploring', 'clue'], ['Photography', 'frame'], ['Nature', 'nature'],
      ['Maps', 'map'], ['Spiderman', 'web'], ['Naruto', 'ninja'], ['Origami', 'origami'],
      ['Pokemon', 'creature'], ['Vampires', 'creature'], ['Movies', 'story'], ['Books', 'story'],
    ] as const;
    for (const [interest, motif] of cases) {
      for (const count of [0, 1]) {
        const child = { ...exampleProfiles[1], interests: [interest] };
        const missionContext = { ...context('kids-reluctant', count), participants: [child], setup: { ...context().setup, participantIds: [child.id] } };
        const plan = questPlanFor(motif, count, 1);
        const mission = await generateMission({ draft: async () => ({ title: plan.title, planChoice: 0 }) }, missionContext);
        expect(mission.memoryMoment.sceneAnchor).toBe(plan.photo.sceneAnchor);
      }
    }
  });

  it('turns a branded child interest into a generic motif on the card', async () => {
    const child = { ...exampleProfiles[1], interests: ['Spiderman'] };
    const branded = { ...context(), participants: [child], setup: { ...context().setup, participantIds: [child.id] } };
    const webQuest = {
      title: 'Web Pattern Hunt', planChoice: 0, premise: 'Follow web patterns to solve the trail.',
      objectives: ['Pick a pretend web power.', 'Spot three web-like shapes outside.', 'Find two more web lines nearby.', 'Choose one pattern as your final web.', 'Solve which web shape links your clues.'],
      bonus: 'Find one extra web shape.',
      photo: { sceneAnchor: 'final web', objectiveIndex: 4, text: 'At your final web, make a web shape and take a photo.' },
    };
    const model: MissionModel = { draft: async () => webQuest };
    const result = await generateMission(model, branded);
    expect(result.interestHook?.interest).toBe('Spiderman');
    expect([result.title, result.premise, ...result.objectives, result.bonus, result.memoryMoment.text].join(' ')).not.toMatch(/spider-?man/i);
  });

  it('repairs one invalid model draft then accepts a valid one', async () => {
    let calls = 0;
    const model: MissionModel = { draft: async () => { calls++; return calls === 1 ? { ...generated(), title: 'The Best Game Stop Hunt' } : generated(); } };
    const result = await generateMission(model, context());
    expect(calls).toBe(2);
    expect(result.memoryMoment.sceneAnchor).toBe('animal hideout');
  });

  it('fails after two invalid drafts without a fixture', async () => {
    const model: MissionModel = { draft: async () => ({ ...generated(), title: 'The Best Game Stop Hunt' }) };
    await expect(generateMission(model, context())).rejects.toThrow('after two attempts');
  });

  it('waits for a slow model until explicitly cancelled', async () => {
    const controller = new AbortController();
    const model: MissionModel = { draft: async (_prompt, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) };
    const pending = generateMission(model, context(), controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
  });
});
