import { config } from './config.js';
import { createMastraMissionGenerator } from './missions.js';
import { exampleProfiles } from './repository.js';

const generator = createMastraMissionGenerator(config);
const blockers = ['kids-reluctant', 'tired', 'short-time', 'bad-weather', 'bored', 'surprise'] as const;
const selected = process.argv.slice(2);
const targets = selected.length ? blockers.filter((blocker) => selected.includes(blocker)) : blockers;
let failures = 0;
for (const blocker of targets) {
  const timeBudget = blocker === 'short-time' ? '30m' : '1h';
  const distance = blocker === 'tired' || blocker === 'bad-weather' ? 'outside' : 'walk';
  try {
    const mission = await generator({
      setup: { participantIds: exampleProfiles.map((profile) => profile.id), blocker, timeBudget, distance },
      participants: exampleProfiles,
      type: 'treasure',
      recentHistory: [],
    });
    console.log(JSON.stringify({ blocker, pass: true, mission }));
  } catch (error) {
    failures++;
    console.error(JSON.stringify({ blocker, pass: false, error: error instanceof Error ? error.message : String(error) }));
  }
}
process.exitCode = failures ? 1 : 0;
