import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MissionDraft } from '@sidequest/contracts';
import { buildServer } from './server.js';
import { FileRepository } from './repository.js';
import type { AppConfig } from './config.js';
import { MissionGenerationError, type MissionContext } from './missions.js';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'sidequest-test-'));
  dirs.push(dir);
  const path = join(dir, 'data.json');
  const repository = await FileRepository.create(path);
  const contexts: MissionContext[] = [];
  const generator = async (context: MissionContext): Promise<MissionDraft> => {
    contexts.push(context);
    return { title: context.type === 'adventure' ? 'New Adventure' : 'Operation Hidden Flags', premise: 'Choose team roles and find a secret trail with your family near home.', difficulty: 2, durationMinutes: 45,
      objectives: ['Choose team roles.', 'Spot a clue.', 'Count three leaves.', 'Find a secret base.', 'Name the route.'], bonus: 'Find a hidden symbol.',
      memoryMoment: { text: 'At your secret base, gather the team and take a victory photo.', objectiveIndex: 4, sceneAnchor: 'secret base' },
      blockerAdaptation: { strategy: 'playful-start', objectiveIndex: 1, explanation: 'Starts with a role.' },
      interestHook: { participantId: context.participants[0].id, interest: 'Gaming', objectiveIndex: 1, explanation: 'Team roles feel like a game.' },
    };
  };
  const config: AppConfig = { port: 0, webOrigin: 'http://127.0.0.1:5174', localDataFile: path, ollamaBaseUrl: 'http://127.0.0.1:11434', ollamaModel: 'gemma4:e4b' };
  const app = await buildServer(config, repository, generator, () => new Date(2026, 9, 7, 12));
  return { app, path, contexts, repository, config };
}

describe('SideQuest API', () => {
  it('persists one active mission, awards XP once, then uses new unlock and history', async () => {
    const { app, path, contexts, repository } = await setup();
    const initial = await app.inject('/api/state');
    const profiles = initial.json().profiles;
    expect(profiles.map((profile: { level: number }) => profile.level)).toEqual([4, 2, 3]);
    const request = { participantIds: profiles.map((profile: { id: string }) => profile.id), blocker: 'kids-reluctant', timeBudget: '1h', distance: 'walk' };
    const created = await app.inject({ method: 'POST', url: '/api/missions', payload: request });
    expect(created.statusCode).toBe(201);
    expect(created.json().type).toBe('treasure');
    expect((await app.inject({ method: 'POST', url: '/api/missions', payload: request })).statusCode).toBe(409);
    expect((await app.inject({ method: 'DELETE', url: `/api/profiles/${profiles[0].id}` })).statusCode).toBe(409);
    expect((await FileRepository.create(path)).snapshot().activeMission?.id).toBe(created.json().id);
    const completeUrl = `/api/missions/${created.json().id}/complete`;
    const completed = await app.inject({ method: 'POST', url: completeUrl, payload: { bonusCompleted: true, rating: 'great' } });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().awards.map((award: { xp: number }) => award.xp)).toEqual([400, 400, 400]);
    expect(completed.json().awards[0].after.level).toBe(5);
    expect(completed.json().streak).toBe(1);
    const duplicate = await app.inject({ method: 'POST', url: completeUrl, payload: { bonusCompleted: false, rating: 'boring' } });
    expect(duplicate.json().alreadyCompleted).toBe(true);
    expect(repository.snapshot().profiles[0].totalXp).toBe(3000);
    expect(repository.snapshot().history).toHaveLength(1);
    const next = await app.inject({ method: 'POST', url: '/api/missions', payload: request });
    expect(next.json().type).toBe('adventure');
    expect(contexts[1].recentHistory[0].rating).toBe('great');
    expect(contexts[1].completedMissionCount).toBe(1);
    await app.close();
  });

  it('discards without XP, then accepts profile edits and a new mission', async () => {
    const { app } = await setup();
    const profiles = (await app.inject('/api/state')).json().profiles;
    const request = { participantIds: [profiles[0].id], blocker: 'kids-reluctant', timeBudget: '1h', distance: 'walk' };
    await app.inject({ method: 'POST', url: '/api/missions', payload: request });
    expect((await app.inject({ method: 'DELETE', url: '/api/missions/active' })).statusCode).toBe(200);
    expect((await app.inject('/api/state')).json().history).toHaveLength(0);
    const edited = await app.inject({ method: 'PATCH', url: `/api/profiles/${profiles[0].id}`, payload: { interests: ['Exploring'] } });
    expect(edited.json().interests).toEqual(['Exploring']);
    const added = await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'Mum', age: 35, interests: ['Hiking'] } });
    expect(added.statusCode).toBe(201);
    expect((await app.inject({ method: 'DELETE', url: `/api/profiles/${added.json().id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/missions', payload: request })).statusCode).toBe(201);
    await app.close();
  });

  it('reports an AI failure without saving a substitute mission', async () => {
    const { app, repository, config } = await setup();
    const unavailable = await buildServer(config, repository, async () => { throw new MissionGenerationError('Ollama is unavailable. Retry after starting it.'); });
    const profile = repository.snapshot().profiles[0];
    const response = await unavailable.inject({ method: 'POST', url: '/api/missions', payload: { participantIds: [profile.id], blocker: 'tired', timeBudget: '30m', distance: 'outside' } });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toContain('Ollama is unavailable');
    expect(repository.snapshot().activeMission).toBeNull();
    await unavailable.close();
    await app.close();
  });

  it('cancels an in-flight generation without saving it and accepts a later request', async () => {
    const { app, repository, config } = await setup();
    let calls = 0;
    const cancellable = await buildServer(config, repository, async (context, signal) => {
      calls++;
      if (calls === 1) await new Promise<void>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new MissionGenerationError('Mission generation was cancelled.')), { once: true }));
      return {
        title: 'Animal Trail Quest', premise: 'Follow the animal trail.', difficulty: 2, durationMinutes: 50,
        objectives: ['Choose a team name.', 'Spot a clue.', 'Count three colors.', 'Choose a safe spot as your secret base.', 'Wave at the finish.'],
        bonus: 'Name another animal.',
        memoryMoment: { text: 'At your secret base, make a fox pose and take a photo.', objectiveIndex: 4, sceneAnchor: 'secret base' },
        blockerAdaptation: { strategy: 'playful-start', objectiveIndex: 1, explanation: 'A playful choice.' },
        interestHook: { participantId: context.participants[0].id, interest: 'Gaming', objectiveIndex: 1, explanation: 'A game theme.' },
      };
    });
    const profile = repository.snapshot().profiles[0];
    const payload = { participantIds: [profile.id], blocker: 'kids-reluctant', timeBudget: '1h', distance: 'walk' };
    const pending = cancellable.inject({ method: 'POST', url: '/api/missions', payload });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await cancellable.inject('/api/state')).json().generating).toBe(true);
    expect((await cancellable.inject({ method: 'DELETE', url: '/api/missions/generation' })).json().cancelled).toBe(true);
    expect((await pending).statusCode).toBe(503);
    expect(repository.snapshot().activeMission).toBeNull();
    expect((await cancellable.inject('/api/state')).json().generating).toBe(false);
    expect((await cancellable.inject({ method: 'POST', url: '/api/missions', payload })).statusCode).toBe(201);
    await cancellable.close();
    await app.close();
  });
});
