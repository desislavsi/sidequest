import type { HistoryEntry, MissionRequest } from '@sidequest/contracts';
import type { MissionType } from './types.js';

export type QuestPlan = {
  title: string;
  premise: string;
  opening: string;
  objectives: [string, string, string, string];
  bonus: string;
  photo: { sceneAnchor: string; objectiveIndex: number; text: string };
};

const plans: Record<string, QuestPlan[]> = {
  'power-up': [
    { title: 'Power-Up Hunt', premise: "Find color and shape power-ups, then guess each other's winning moves.", opening: 'power-up move', objectives: [
      'Find three red things for fire power-ups.',
      'Spot two round things for shield power-ups.',
      'Choose one odd shape as your final power-up.',
      'Act out one power-up for the team to guess.',
    ], bonus: 'Find one blue thing as a bonus power-up.',
    photo: { sceneAnchor: 'final power-up', objectiveIndex: 4, text: 'After your team wins, show your favorite move beside the final power-up and take a photo.' } },
    { title: 'Robot Training', premise: 'Find outdoor power-ups to teach your pretend robot three new moves.', opening: 'robot role', objectives: [
      'Find three colors to recharge your robot power-ups.',
      'Invent one robot move for each color.',
      'Choose one safe object as your final power-up station.',
      'Repeat your three robot moves to finish training.',
    ], bonus: 'Invent one extra robot power-up move.',
    photo: { sceneAnchor: 'final power-up station', objectiveIndex: 4, text: 'At your final power-up station, show your robot moves and take a photo.' } },
  ],
  goal: [{ title: 'The Invisible Cup', premise: 'Score goals together in a family cup with a real or pretend ball.', opening: 'goal-scoring trick', objectives: [
    'Choose two safe markers as your goalposts.',
    'Score three goals with a real or pretend ball.',
    'Pass the imaginary ball around the team five times.',
    'Score one final team goal between the goalposts.',
  ], bonus: 'Score one bonus goal with your other foot.',
  photo: { sceneAnchor: 'goalposts', objectiveIndex: 2, text: 'At your goalposts, show your best goal celebration and take a photo.' } },
  { title: 'The Goal Route', premise: 'Follow three safe stops with a real or pretend ball before scoring.', opening: 'goal-scoring move', objectives: [
    'Choose two safe markers as your goalposts.',
    'Find three nearby stops for your goal route.',
    'Dribble a real or pretend ball through those stops.',
    'Score the winning goal between your goalposts.',
  ], bonus: 'Score one extra goal from a new angle.',
  photo: { sceneAnchor: 'goalposts', objectiveIndex: 2, text: 'At your goalposts, show your winning kick and take a photo.' } }],
  animal: [
    { title: 'Animal Home Detectives', premise: 'Follow pretend animal clues to choose a hideout for your imaginary visitor.', opening: 'pretend animal to help', objectives: [
      'Spot three shapes like animal tracks.',
      'Find two places a small animal could hide.',
      'Choose one of those places as your animal hideout.',
      'Solve which animal could live in the hideout.',
    ], bonus: 'Find one more animal clue nearby.',
    photo: { sceneAnchor: 'animal hideout', objectiveIndex: 4, text: 'At your animal hideout, pose as that animal and take a photo.' } },
    { title: 'Animal Parade', premise: 'Find animal shapes and lead a pretend parade of silly animal walks.', opening: 'pretend animal to become', objectives: [
      'Find three shapes that look like animal features.',
      'Copy two different animal walks.',
      'Choose one safe landmark as your parade finish.',
      'Lead your animal parade to the finish.',
    ], bonus: 'Invent one extra animal parade move.',
    photo: { sceneAnchor: 'parade finish', objectiveIndex: 4, text: 'At your parade finish, show your favorite animal walk and take a photo.' } },
  ],
  shape: [{ title: 'The Tiny Town', premise: 'Use shapes outside to map a tiny pretend town.', opening: 'shape for your tiny town', objectives: [
    'Find two shapes that could be town buildings.',
    'Spot a line that could be the town road.',
    'Choose one safe landmark as your town square.',
    'Lead the team from the shape buildings to the town square.',
  ], bonus: 'Find one extra shape for a new town building.',
  photo: { sceneAnchor: 'town square', objectiveIndex: 4, text: 'At your town square, act like busy townspeople and take a photo.' } }],
  code: [{ title: 'The Shape Code', premise: "Find shapes outside to make your team's secret code.", opening: 'shape code clue', objectives: [
    'Find three round things for your shape code.',
    'Spot two corners for the next code clue.',
    'Choose one new shape as your final code clue.',
    'Invent a short shape code using your three clues.',
  ], bonus: 'Find one extra shape for a bonus code.',
  photo: { sceneAnchor: 'final code clue', objectiveIndex: 4, text: 'At your final code clue, show its shape with your arms and take a photo.' } },
  { title: 'The Odd Shape Out', premise: 'Find matching shapes, then solve which code clue does not belong.', opening: 'code clue', objectives: [
    'Find three round shapes for your code.',
    'Spot one shape that does not match.',
    'Choose the odd shape as your final code clue.',
    'Solve why the final code clue is different.',
  ], bonus: 'Find one more odd shape for your code.',
  photo: { sceneAnchor: 'final code clue', objectiveIndex: 4, text: 'At your final code clue, make its shape with your arms and take a photo.' } }],
  clue: [{ title: 'The Three-Clue Trail', premise: 'Find three clues outside, then make a secret message from them.', opening: 'clue to follow', objectives: [
    'Find a shape that could be your first clue.',
    'Spot a different color for your second clue.',
    'Choose one safe landmark as your final clue.',
    'Make a secret message from your three clues.',
  ], bonus: 'Find one extra clue with a new color.',
  photo: { sceneAnchor: 'final clue', objectiveIndex: 4, text: 'At your final clue, point to your discovery and take a photo.' } },
  { title: 'The Way Back', premise: 'Follow outdoor clues, then guide your team back to its starting point.', opening: 'clue to follow', objectives: [
    'Find one safe landmark as your start marker.',
    'Spot two different shapes as route clues.',
    'Choose one safe landmark as your last clue.',
    'Lead the team back to your start marker.',
  ], bonus: 'Spot one extra clue on your return route.',
  photo: { sceneAnchor: 'start marker', objectiveIndex: 2, text: 'Back at your start marker, point along your route and take a photo.' } }],
  frame: [{ title: 'The Story Frame', premise: 'Find three views outside and act out the story they tell.', opening: 'frame for a pretend story', objectives: [
    'Find a close-up view for your first frame.',
    'Spot a wide view for your second frame.',
    'Choose one view as your final frame.',
    'Act out the story told by your three frames.',
  ], bonus: 'Find one extra frame with a funny shape.',
  photo: { sceneAnchor: 'final frame', objectiveIndex: 4, text: 'At your final frame, act out the story and take a photo.' } }],
  nature: [{ title: 'Nature Code', premise: 'Find nature clues to invent a secret team signal.', opening: 'nature clue', objectives: [
    'Find three different colors in nature.',
    'Spot two shapes made by nature.',
    'Choose one safe object as your final nature clue.',
    'Invent a team signal using your nature clues.',
  ], bonus: 'Find one extra nature clue with a new shape.',
  photo: { sceneAnchor: 'final nature clue', objectiveIndex: 4, text: 'At your final nature clue, show its shape and take a photo.' } }],
  map: [{ title: 'The Human Map', premise: 'Follow your own simple map from start to finish.', opening: 'map marker', objectives: [
    'Find one nearby landmark as your map start.',
    'Spot a second landmark as your map turn.',
    'Choose one safe landmark as your map finish.',
    'Lead the team to your map finish.',
  ], bonus: 'Name one new turn on your pretend map.',
  photo: { sceneAnchor: 'map finish', objectiveIndex: 4, text: 'At your map finish, point back along your route and take a photo.' } }],
  web: [{ title: 'Web Pattern Trail', premise: 'Find web-like lines outside and copy the final shape.', opening: 'web pattern to hunt', objectives: [
    'Spot three web-like lines outside.',
    'Find two shapes made from crossing web lines.',
    'Choose one safe pattern as your final web.',
    'Copy the final web shape with your arms.',
  ], bonus: 'Find one extra web-like line nearby.',
  photo: { sceneAnchor: 'final web', objectiveIndex: 4, text: 'At your final web, make its shape with your arms and take a photo.' } }],
  ninja: [{ title: 'Quiet Ninja Clues', premise: 'Find quiet clues and finish with a silent ninja shape.', opening: 'ninja move', objectives: [
    'Find three quiet clues you can see outside.',
    'Spot two shapes that could be ninja signals.',
    'Choose one safe shape as your final ninja clue.',
    'Copy the final ninja shape without making a sound.',
  ], bonus: 'Find one extra ninja signal nearby.',
  photo: { sceneAnchor: 'final ninja clue', objectiveIndex: 4, text: 'At your final ninja clue, make a quiet ninja pose and take a photo.' } }],
  creature: [{ title: 'Creature Clue Quest', premise: 'Find outdoor shapes to invent a brand-new imaginary creature.', opening: 'creature power', objectives: [
    "Find three shapes for your creature's body.",
    "Spot two colors for your creature's disguise.",
    "Choose one safe object as your creature's home.",
    'Act out how your creature reaches its home.',
  ], bonus: 'Invent one extra creature move.',
  photo: { sceneAnchor: "creature's home", objectiveIndex: 4, text: "At your creature's home, show its funniest move and take a photo." } }],
  story: [{ title: 'Three-Scene Story', premise: 'Find three outdoor scenes and act out a short family story.', opening: 'story role', objectives: [
    "Find one shape for your story's first scene.",
    "Spot a different color for your story's next scene.",
    'Choose one safe landmark as your final story scene.',
    "Act out your story's ending at that scene.",
  ], bonus: 'Invent one extra ending for your story.',
  photo: { sceneAnchor: 'final story scene', objectiveIndex: 4, text: 'At your final story scene, act out the ending and take a photo.' } }],
};

export function openingFor(blocker: MissionRequest['blocker'], phrase: string): string {
  switch (blocker) {
    case 'kids-reluctant': return `Pick a silly ${phrase}.`;
    case 'tired': return `Pick an easy ${phrase} close to home.`;
    case 'short-time': return `Pick a quick ${phrase} near home.`;
    case 'bad-weather': return `Pick a ${phrase} for a short outdoor quest.`;
    case 'bored': return `Pick a strange ${phrase}.`;
    case 'surprise': return `Pick a ${phrase}.`;
  }
}

function relatedTitles(first: string, second: string): boolean {
  const words = (value: string) => value.toLowerCase().match(/[a-z]{4,}/g)?.filter((word) => !['quest', 'hunt', 'mission', 'the', 'final'].includes(word)) ?? [];
  const other = new Set(words(second));
  return words(first).some((word) => other.has(word));
}

export function questPlanFor(motif: string | null, completedMissionCount: number, childCount: number, recentHistory: Pick<HistoryEntry, 'title' | 'rating'>[] = [], type: MissionType = 'basic'): QuestPlan {
  const choices = motif ? plans[motif] : null;
  if (choices) {
    const typeOffset: Record<MissionType, number> = { basic: 0, treasure: 0, adventure: 1, mystery: 2, epic: 3 };
    let index = (Math.floor(completedMissionCount / Math.max(childCount, 1)) + typeOffset[type]) % choices.length;
    if (choices.length > 1) {
      const disliked = recentHistory.slice(-5).filter((entry) => entry.rating === 'boring');
      for (let checked = 0; checked < choices.length; checked++) {
        if (!disliked.some((entry) => relatedTitles(entry.title, choices[index].title))) break;
        index = (index + 1) % choices.length;
      }
    }
    return choices[index];
  }
  const theme = motif ?? 'clue';
  return {
    title: 'The Discovery Trail', premise: `Find outdoor clues linked to ${theme} and invent a story.`, opening: `${theme} clue`, objectives: [
      `Find three outdoor things linked to ${theme}.`,
      `Spot two different shapes for your ${theme} clues.`,
      `Choose one safe object as your final ${theme} clue.`,
      `Invent a story using your ${theme} clues.`,
    ], bonus: `Find one extra ${theme} clue nearby.`,
    photo: { sceneAnchor: `final ${theme} clue`, objectiveIndex: 4, text: `At your final ${theme} clue, show your answer and take a photo.` },
  };
}

export function questPlanOptionsFor(motif: string | null, completedMissionCount: number, childCount: number, recentHistory: Pick<HistoryEntry, 'title' | 'rating'>[] = [], type: MissionType = 'basic'): QuestPlan[] {
  const preferred = questPlanFor(motif, completedMissionCount, childCount, recentHistory, type);
  const choices = motif ? plans[motif] : null;
  if (!choices || choices.length < 2) return [preferred];
  const disliked = recentHistory.slice(-5).filter((entry) => entry.rating === 'boring');
  const alternatives = choices.filter((plan) => plan !== preferred);
  const likedAlternatives = alternatives.filter((plan) => !disliked.some((entry) => relatedTitles(entry.title, plan.title)));
  const preferredDisliked = disliked.some((entry) => relatedTitles(entry.title, preferred.title));
  return [preferred, ...(likedAlternatives.length || !preferredDisliked ? likedAlternatives : alternatives)].slice(0, 2);
}
