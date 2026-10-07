import { z } from 'zod';

const short = (max: number) => z.string().trim().min(1).max(max);

export const blockerSchema = z.enum(['kids-reluctant', 'tired', 'short-time', 'bad-weather', 'bored', 'surprise']);
export const timeBudgetSchema = z.enum(['30m', '1h', '2h+']);
export const distanceSchema = z.enum(['outside', 'walk', 'drive']);
export const missionTypeSchema = z.enum(['basic', 'treasure', 'adventure', 'mystery', 'epic']);
export const ratingSchema = z.enum(['boring', 'okay', 'great']);
export const strategySchema = z.enum(['playful-start', 'low-effort', 'compact-route', 'weather-ready', 'novel-twist', 'open-surprise']);

export const profileInputSchema = z.object({
  name: short(20),
  age: z.number().int().min(1).max(120),
  interests: z.array(short(30)).max(8),
});
export const profileSchema = profileInputSchema.extend({ id: z.string().uuid(), totalXp: z.number().int().nonnegative() });
export type Profile = z.infer<typeof profileSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const missionRequestSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1).max(6),
  blocker: blockerSchema,
  timeBudget: timeBudgetSchema,
  distance: distanceSchema,
}).refine((value) => new Set(value.participantIds).size === value.participantIds.length, 'Select each participant once.');
export type MissionRequest = z.infer<typeof missionRequestSchema>;

export const missionDraftSchema = z.object({
  title: short(42),
  premise: short(220),
  difficulty: z.number().int().min(1).max(3),
  durationMinutes: z.number().int().min(15).max(180),
  objectives: z.array(short(120)).length(5),
  bonus: short(120),
  memoryMoment: z.object({ text: short(175), objectiveIndex: z.number().int().min(1).max(5), sceneAnchor: short(40) }),
  blockerAdaptation: z.object({ strategy: strategySchema, objectiveIndex: z.number().int().min(1).max(5), explanation: short(180) }),
  interestHook: z.object({ participantId: z.string().uuid(), interest: short(30), objectiveIndex: z.number().int().min(1).max(5), explanation: short(180) }).nullable(),
});
export type MissionDraft = z.infer<typeof missionDraftSchema>;

export const missionReviewSchema = z.object({
  blockerAdapted: z.boolean(),
  interestIntegrated: z.boolean(),
  memoryMomentSpecific: z.boolean(),
  questLike: z.boolean(),
  typeFit: z.boolean(),
  ageAppropriate: z.boolean(),
  copyrightSafe: z.boolean(),
  reason: short(2000),
});
export type MissionReview = z.infer<typeof missionReviewSchema>;

export const participantSnapshotSchema = z.object({ id: z.string().uuid(), name: short(20), level: z.number().int().positive() });
export const activeMissionSchema = missionDraftSchema.omit({ blockerAdaptation: true, interestHook: true }).extend({
  id: z.string().uuid(),
  type: missionTypeSchema,
  participants: z.array(participantSnapshotSchema).min(1).max(6),
  setup: missionRequestSchema,
  baseXp: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type ActiveMission = z.infer<typeof activeMissionSchema>;

export const historyEntrySchema = z.object({
  id: z.string().uuid(),
  title: short(42),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  participants: z.array(short(20)).min(1),
  type: missionTypeSchema,
  xp: z.number().int().positive(),
  rating: ratingSchema,
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const completionInputSchema = z.object({ bonusCompleted: z.boolean(), rating: ratingSchema });
export type CompletionInput = z.infer<typeof completionInputSchema>;

export const snapshotSchema = z.object({
  profiles: z.array(profileSchema),
  activeMission: activeMissionSchema.nullable(),
  history: z.array(historyEntrySchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
