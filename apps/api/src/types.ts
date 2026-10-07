import type { z } from 'zod';
import type { blockerSchema, historyEntrySchema, missionTypeSchema, timeBudgetSchema } from '@sidequest/contracts';
export type Blocker = z.infer<typeof blockerSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type MissionType = z.infer<typeof missionTypeSchema>;
export type TimeBudget = z.infer<typeof timeBudgetSchema>;
