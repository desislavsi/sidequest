import { missionTypeSchema } from '@sidequest/contracts';
import { config } from './config.js';
import { createMastraMissionGenerator } from './missions.js';
import { exampleProfiles } from './repository.js';
import { chooseMissionType } from './progression.js';

try {
  const participants = exampleProfiles;
  const completedMissionCount = Number(process.argv[2] ?? 0);
  if (!Number.isInteger(completedMissionCount) || completedMissionCount < 0) throw new Error('Pass a nonnegative completed mission count.');
  const type = process.argv[3] ? missionTypeSchema.parse(process.argv[3]) : chooseMissionType(4, []);
  const mission = await createMastraMissionGenerator(config)({
    setup: { participantIds: participants.map((item) => item.id), blocker: 'kids-reluctant', timeBudget: '1h', distance: 'walk' },
    participants,
    type,
    recentHistory: [],
    completedMissionCount,
  });
  console.log(JSON.stringify({ pass: true, mission }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
