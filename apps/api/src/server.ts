import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import {
  activeMissionSchema,
  completionInputSchema,
  historyEntrySchema,
  missionRequestSchema,
  profileInputSchema,
  profileSchema,
  type Profile,
} from '@sidequest/contracts';
import type { AppConfig } from './config.js';
import type { MissionGenerator } from './missions.js';
import { MissionGenerationError } from './missions.js';
import { FileRepository } from './repository.js';
import { baseXpFor, chooseMissionType, familyStreak, levelProgress, localDateKey, unlockedTypes } from './progression.js';

class ConflictError extends Error {}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function profileView(profile: Profile) {
  const progress = levelProgress(profile.totalXp);
  return { ...profile, ...progress, unlocks: unlockedTypes(progress.level) };
}

export async function buildServer(config: AppConfig, repository: FileRepository, generator: MissionGenerator, now: () => Date = () => new Date()) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: config.webOrigin });
  let generating = false;
  let generationController: AbortController | null = null;

  const state = () => {
    const snapshot = repository.snapshot();
    return {
      profiles: snapshot.profiles.map(profileView),
      activeMission: snapshot.activeMission,
      history: snapshot.history.slice(-10).reverse(),
      streak: familyStreak(snapshot.history, now()),
      generating,
    };
  };

  function fail(error: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'Invalid request.', details: error.issues });
    if (error instanceof ConflictError) return reply.code(409).send({ error: message(error) });
    if (error instanceof MissionGenerationError) return reply.code(503).send({ error: message(error) });
    app.log.error(error);
    return reply.code(500).send({ error: 'SideQuest could not finish that request. Please retry.' });
  }

  app.get('/health', async () => ({ ok: true, service: 'sidequest' }));
  app.get('/api/state', async () => state());
  app.delete('/api/missions/generation', async () => {
    if (!generationController || generationController.signal.aborted) return { cancelled: false };
    generationController.abort();
    return { cancelled: true };
  });

  app.post('/api/profiles', async (request, reply) => {
    try {
      const input = profileInputSchema.parse(request.body);
      const profile = profileSchema.parse({ ...input, id: randomUUID(), totalXp: 0 });
      await repository.update((draft) => { draft.profiles.push(profile); });
      return reply.code(201).send(profileView(profile));
    } catch (error) { return fail(error, reply); }
  });

  app.patch('/api/profiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = profileInputSchema.partial().parse(request.body);
      const profile = await repository.update((draft) => {
        const index = draft.profiles.findIndex((item) => item.id === id);
        if (index < 0) return null;
        const updated = profileSchema.parse({ ...draft.profiles[index], ...input });
        draft.profiles[index] = updated;
        return updated;
      });
      return profile ? profileView(profile) : reply.code(404).send({ error: 'Profile not found.' });
    } catch (error) { return fail(error, reply); }
  });

  app.delete('/api/profiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await repository.update((draft) => {
        if (draft.activeMission?.participants.some((item) => item.id === id)) throw new ConflictError('Discard or complete the active mission before removing this participant.');
        const length = draft.profiles.length;
        draft.profiles = draft.profiles.filter((item) => item.id !== id);
        return draft.profiles.length !== length;
      });
      return deleted ? { deleted: true } : reply.code(404).send({ error: 'Profile not found.' });
    } catch (error) { return fail(error, reply); }
  });

  app.post('/api/missions', async (request, reply) => {
    try {
      const setup = missionRequestSchema.parse(request.body);
      if (generating) throw new ConflictError('A mission is already being created.');
      const snapshot = repository.snapshot();
      if (snapshot.activeMission) throw new ConflictError('Complete or discard the active mission first.');
      const participants = setup.participantIds.map((id) => snapshot.profiles.find((item) => item.id === id));
      if (participants.some((item) => !item)) return reply.code(400).send({ error: 'Select existing family members.' });
      const selected = participants as Profile[];
      const highestLevel = Math.max(...selected.map((item) => levelProgress(item.totalXp).level));
      const type = chooseMissionType(highestLevel, snapshot.history);
      const controller = new AbortController();
      generating = true;
      generationController = controller;
      try {
        const draft = await generator({ setup, participants: selected, type, recentHistory: snapshot.history.slice(-8), completedMissionCount: snapshot.history.length }, controller.signal);
        if (controller.signal.aborted) throw new MissionGenerationError('Mission generation was cancelled.');
        const mission = activeMissionSchema.parse({
          ...draft,
          id: randomUUID(),
          type,
          participants: selected.map((item) => ({ id: item.id, name: item.name, level: levelProgress(item.totalXp).level })),
          setup,
          baseXp: baseXpFor(setup.timeBudget),
          createdAt: now().toISOString(),
        });
        await repository.update((current) => {
          if (controller.signal.aborted) throw new MissionGenerationError('Mission generation was cancelled.');
          if (current.activeMission) throw new ConflictError('An active mission already exists.');
          if (selected.some((item) => !current.profiles.some((profile) => profile.id === item.id))) throw new ConflictError('A selected profile changed while creating the mission. Please retry.');
          current.activeMission = mission;
        });
        return reply.code(201).send(mission);
      } finally { generating = false; generationController = null; }
    } catch (error) { return fail(error, reply); }
  });

  app.delete('/api/missions/active', async (_request, reply) => {
    try {
      const discarded = await repository.update((draft) => {
        if (!draft.activeMission) return false;
        draft.activeMission = null;
        return true;
      });
      return discarded ? { discarded: true } : reply.code(404).send({ error: 'No active mission.' });
    } catch (error) { return fail(error, reply); }
  });

  app.post('/api/missions/:id/complete', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = completionInputSchema.parse(request.body);
      const result = await repository.update((draft) => {
        const existing = draft.history.find((item) => item.id === id);
        if (existing) return { alreadyCompleted: true, historyEntry: existing, awards: [] };
        const mission = draft.activeMission;
        if (!mission || mission.id !== id) return null;
        const xp = mission.baseXp + (input.bonusCompleted ? 50 : 0);
        const awards = mission.participants.map((participant) => {
          const profile = draft.profiles.find((item) => item.id === participant.id);
          if (!profile) throw new ConflictError('An active participant profile is missing.');
          const before = levelProgress(profile.totalXp);
          profile.totalXp += xp;
          return { name: profile.name, xp, before, after: levelProgress(profile.totalXp) };
        });
        const historyEntry = historyEntrySchema.parse({
          id: mission.id,
          title: mission.title,
          date: localDateKey(now()),
          participants: mission.participants.map((item) => item.name),
          type: mission.type,
          xp,
          rating: input.rating,
        });
        draft.history.push(historyEntry);
        draft.activeMission = null;
        return { alreadyCompleted: false, historyEntry, awards };
      });
      return result ? { ...result, streak: state().streak } : reply.code(404).send({ error: 'Mission not found.' });
    } catch (error) { return fail(error, reply); }
  });

  return app;
}
