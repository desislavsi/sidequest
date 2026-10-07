import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import {
  missionDraftSchema,
  type HistoryEntry,
  type MissionDraft,
  type MissionRequest,
  type Profile,
} from '@sidequest/contracts';
import type { AppConfig } from './config.js';
import { blockerStrategies } from './progression.js';
import { openingFor, questPlanOptionsFor, type QuestPlan } from './quest-plans.js';
import type { MissionType } from './types.js';

export type MissionContext = {
  setup: MissionRequest;
  participants: Profile[];
  type: MissionType;
  recentHistory: HistoryEntry[];
  completedMissionCount?: number;
};
export type MissionGenerator = (context: MissionContext, signal?: AbortSignal) => Promise<MissionDraft>;

export class MissionGenerationError extends Error {
  constructor(message: string) { super(message); this.name = 'MissionGenerationError'; }
}

// Gemma chooses and names a validated quest plan. The server owns its connected tasks.
const generatedSchema = z.object({
  title: z.string().min(1).max(80),
  planChoice: z.number().int().min(0).max(1),
});
type Generated = z.infer<typeof generatedSchema>;
type SelectedInterest = { participantId: string; name: string; age: number; interest: string };

const brandNames = /\b(?:spider[- ]?man|naruto|marvel|disney|pokemon|minecraft|star wars|harry potter)\b/i;
const jargon = /\b(?:camouflage|habitat|artifact|designate|determine|identify|foraging|primary|synchronized|commemorate|utilize|investigate|navigate)\b/i;
const secondAction = /\band\s+(?:find|choose|pick|spot|count|name|tell|point|make|look|walk|run|jump|pretend|say|take|go|call|check|touch|show|describe|list|whisper|collect|cheer|share|score|solve|finish|reach|freeze|repeat|dribble)\b/i;
const actionStart = /^(?:choose|pick|find|spot|count|name|tell|talk|whisper|wave|walk|look|pretend|make|say|point|show|compare|listen|notice|check|vote|invent|guess|follow|stay|sit|stand|rest|move|skip|seek|play|search|share|jump|score|solve|finish|reach|freeze|match|copy|lead|cross|kick|pass|act|repeat|dribble)\b/i;
const interestMotifs: Record<string, string> = {
  gaming: 'power-up', football: 'goal', exploring: 'clue', animals: 'animal', building: 'shape', puzzles: 'code',
  photography: 'frame', nature: 'nature', maps: 'map', spiderman: 'web', 'spider-man': 'web', naruto: 'ninja',
  vampires: 'creature', movies: 'story', books: 'story', minecraft: 'shape', pokemon: 'creature',
};

const wordCount = (value: string) => value.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0;
const includes = (value: string, phrase: string) => value.toLowerCase().includes(phrase.trim().toLowerCase());
const motifFor = (interest: string) => interestMotifs[interest.trim().toLowerCase()] ?? interest.toLowerCase().match(/[a-z]+/)?.[0] ?? 'team';
const simpleWords = (value: string) => value.replace(/\bobserve\b/gi, 'watch').replace(/\bobservation\b/gi, 'watching')
  .replace(/\bwildlife\b/gi, 'animals').replace(/\btextures\b/gi, 'shapes').replace(/\bviewing zone\b/gi, 'watch spot')
  .replace(/\bsurroundings\b/gi, 'outside');
const cleanText = (value: string) => simpleWords(value.trim().replace(/^\d+[.)]\s*/, '').replace(/\s+/g, ' '));
const cleanTitle = (value: string) => cleanText(value).replace(/^(?:the )?(?:amazing|ultimate|best|great)\s+/i, '').split(/\s*:\s*/)[0].trim();

function assertSimple(value: string, maxWords: number, label: string) {
  if (wordCount(value) > maxWords || /[;()]/.test(value) || (value.match(/[.!?]/g)?.length ?? 0) > 1) {
    throw new Error(`${label} needs one short, clear sentence (${maxWords} words maximum).`);
  }
  if (jargon.test(value)) throw new Error(`${label} uses words that are too complex for young children.`);
}

export function selectMissionInterests(context: MissionContext): { featured: SelectedInterest | null; secondary: SelectedInterest | null } {
  const interested = context.participants.filter((person) => person.interests.length > 0);
  const children = interested.filter((person) => person.age < 18).sort((a, b) => a.age - b.age || a.id.localeCompare(b.id));
  const pool = children.length ? children : interested;
  if (!pool.length) return { featured: null, secondary: null };
  const count = context.completedMissionCount ?? context.recentHistory.length;
  const index = count % pool.length;
  const person = pool[index];
  const interestIndex = Math.floor(count / pool.length) % person.interests.length;
  const featured = { participantId: person.id, name: person.name, age: person.age, interest: person.interests[interestIndex] };
  const otherChild = children.length > 1 ? children[(index + 1) % children.length] : null;
  const secondary = otherChild ? { participantId: otherChild.id, name: otherChild.name, age: otherChild.age, interest: otherChild.interests[0] } : null;
  return { featured, secondary };
}

function normalizeGenerated(raw: unknown, context: MissionContext, featured: SelectedInterest | null, options: QuestPlan[]): MissionDraft {
  const value = generatedSchema.parse(raw) as Generated;
  const plan = options[value.planChoice];
  if (!plan) throw new Error('The chosen quest plan is unavailable.');
  const motif = featured ? motifFor(featured.interest) : null;
  const objectives = [openingFor(context.setup.blocker, plan.opening), ...plan.objectives];
  const motifIndex = motif ? objectives.findIndex((item) => includes(item, motif)) : -1;
  if (motif && motifIndex < 0) throw new Error(`The ${motif} plan needs an interest-driven step.`);
  const durationMinutes = ({ '30m': 25, '1h': 50, '2h+': 120 } as const)[context.setup.timeBudget];
  const difficulty = ({ basic: 1, treasure: 2, adventure: 2, mystery: 3, epic: 3 } as const)[context.type];
  return {
    title: cleanTitle(value.title), premise: plan.premise, objectives, bonus: plan.bonus,
    difficulty, durationMinutes,
    memoryMoment: plan.photo,
    blockerAdaptation: { strategy: blockerStrategies[context.setup.blocker].strategy as MissionDraft['blockerAdaptation']['strategy'], objectiveIndex: 1, explanation: 'The first step applies the selected blocker strategy.' },
    interestHook: featured ? { participantId: featured.participantId, interest: featured.interest, objectiveIndex: motifIndex + 1, explanation: `The ${motif} theme shapes this challenge.` } : null,
  };
}

export function validateMissionDraft(raw: unknown, context: MissionContext): MissionDraft {
  const draft = missionDraftSchema.parse(raw);
  assertSimple(draft.title, 7, 'Mission title');
  assertSimple(draft.premise, 18, 'Mission premise');
  if (/^(?:the )?(?:family|outdoor|sidequest)?\s*(?:mission|quest|challenge)$/i.test(draft.title)) throw new Error('Mission title is too generic.');
  draft.objectives.forEach((objective, index) => {
    assertSimple(objective, 12, `Objective ${index + 1}`);
    if (!actionStart.test(objective)) throw new Error(`Objective ${index + 1} must start with a clear action.`);
    if (secondAction.test(objective)) throw new Error(`Objective ${index + 1} contains more than one action.`);
  });
  assertSimple(draft.bonus, 12, 'Bonus');
  if (!actionStart.test(draft.bonus)) throw new Error('Bonus must start with a clear action.');
  assertSimple(draft.memoryMoment.text, 22, 'Main photo objective');
  const weakTask = /\b(?:team name|game stop|talk about|pretend to cheer|wave at the finish|count the spots|play our game|biggest game|new game spot|watching us right now|(?:best|perfect|ideal)\s+(?:\w+\s+){0,2}(?:spot|stop|place))\b/i;
  if (weakTask.test([draft.title, draft.premise, ...draft.objectives, draft.bonus].join(' '))) throw new Error('Mission has a filler task instead of a real challenge.');
  if (new Set(draft.objectives.map((item) => item.toLowerCase().replace(/[^a-z]+/g, ' ').trim())).size !== 5) throw new Error('Mission repeats a task.');
  if (draft.objectives.filter((item) => /^(?:find|spot|count|search|solve|score|match|follow|reach|kick|pass|copy|repeat|lead)\b/i.test(item)).length < 2) {
    throw new Error('Mission needs at least two concrete find-or-do challenges.');
  }
  if (draft.objectives.filter((item) => /^(?:choose|pick|name|talk|tell|pretend|say)\b/i.test(item)).length > 2) throw new Error('Mission relies too much on choosing or talking.');
  if (/^(?:wave|cheer|talk|tell|say|pretend)\b/i.test(draft.objectives[4])) throw new Error('The final step must finish the quest with an achievement.');
  if (brandNames.test([draft.title, draft.premise, ...draft.objectives, draft.bonus, draft.memoryMoment.text].join(' '))) throw new Error('Mission uses a copyrighted name.');
  if (draft.blockerAdaptation.strategy !== blockerStrategies[context.setup.blocker].strategy) throw new Error('Mission does not use the selected blocker strategy.');
  const lockedTypeNames: Record<MissionType, RegExp | null> = {
    basic: /\b(treasure|adventure|mystery|epic)\b/i, treasure: /\b(adventure|mystery|epic)\b/i,
    adventure: /\b(mystery|epic)\b/i, mystery: /\bepic\b/i, epic: null,
  };
  if (lockedTypeNames[context.type]?.test(draft.title)) throw new Error('Mission title claims a locked quest type.');
  const cardText = [draft.title, draft.premise, ...draft.objectives, draft.bonus, draft.memoryMoment.text].join(' ');
  if (/\b(sceneAnchor|objectiveIndex|blockerAdaptation|interestHook)\b/i.test(cardText)) throw new Error('Mission contains internal metadata.');
  const scene = draft.memoryMoment.sceneAnchor;
  const linked = draft.objectives[draft.memoryMoment.objectiveIndex - 1];
  if (wordCount(scene) > 5 || /^(?:the |your |a )?(?:family|team|group|outside|photo|game|spot|stop|place|area|checkpoint)$/i.test(scene) || /\b(?:game stop|team spot|secret base)\b/i.test(scene)) throw new Error('Main photo objective needs a concrete scene from the quest.');
  if (!includes(linked, scene) || !includes(draft.memoryMoment.text, scene)) throw new Error('Main photo scene must match its linked objective.');
  if (!/^(?:choose|pick|find|spot)\b/i.test(linked) || linked.toLowerCase().indexOf(scene.toLowerCase()) < 0) throw new Error('Linked objective must first choose or find the photo scene.');
  if (draft.objectives.slice(0, draft.memoryMoment.objectiveIndex - 1).some((item) => includes(item, scene))) throw new Error('Photo scene is referenced before it is established.');
  if (['at', 'in', 'near', 'under', 'behind', 'inside'].some((place) => ['the', 'your', 'our'].some((article) => includes(draft.premise, `${place} ${article} ${scene}`)))) {
    throw new Error('Premise assumes the photo scene already exists.');
  }
  if (!/\btake a photo\b/i.test(draft.memoryMoment.text)) throw new Error('Main objective must explicitly ask for a photo.');
  if (/\b(?:family photo|team photo|winning team pose|best team pose|smile for|pose together)\b/i.test(draft.memoryMoment.text)) throw new Error('Main photo objective must show a mission-specific achievement.');
  if (!/\b(?:point|pointing|show|showing|act|acting|make|making|pose|posing|hold|holding|freeze|celebrate|pretend|copy|stand|standing|sit|sitting)\b/i.test(draft.memoryMoment.text)) throw new Error('Main photo objective needs a specific action at the discovered scene.');
  if (/\b(photo|photograph|picture|record|capture|snap|film|video|write|draw|sketch)\b/i.test([...draft.objectives, draft.bonus].join(' '))) throw new Error('Steps and bonus must not require a camera, phone, writing or drawing.');
  if (/\b(build|construct|stack|arrange|collect|carry)\b/i.test(cardText)) throw new Error('Mission must not claim that the family builds or moves objects.');
  if (/\b(barefoot|bare feet|without shoes|remove (?:your|their) shoes|climb|enter (?:the )?water|cross (?:the |a )?road|approach (?:wild |unknown )?animals?)\b/i.test(cardText)) throw new Error('Mission contains an unsafe outdoor action.');
  if (/\b(?:rain is falling|snow is falling|the sun is shining|the sky is clear|today is sunny|today is raining)\b/i.test(cardText)) throw new Error('Mission claims to know the current weather.');
  if (/\b(?:stranger|someone you|person you pass|ask (?:a|the) person|touch (?:a|an|the|unknown))\b/i.test(cardText)) throw new Error('Mission requires a stranger or unsafe contact.');
  if (/\b(marked spot|marked zone|designated trail|hidden stone mound|winding path|path junction|where shadows are longest)\b/i.test(cardText)) throw new Error('Mission assumes a landmark that may not exist.');
  if (/\b(?:\+?\d+\s*xp|bonus points?|double points?)\b/i.test([draft.premise, ...draft.objectives, draft.bonus].join(' '))) throw new Error('Mission must not promise XP or points outside the reward rules.');
  const { featured } = selectMissionInterests(context);
  if (featured && (!draft.interestHook || draft.interestHook.participantId !== featured.participantId || draft.interestHook.interest.toLowerCase() !== featured.interest.toLowerCase())) throw new Error('Mission must use the featured child interest.');
  if (!featured && draft.interestHook) throw new Error('Mission cites an unselected interest.');
  if (featured) {
    const motif = motifFor(featured.interest);
    if (!includes(`${draft.title} ${draft.premise}`, motif)) throw new Error(`The ${motif} theme must shape the mission title or premise.`);
    if (draft.objectives.filter((item) => includes(item, motif)).length < 2) throw new Error(`The ${motif} interest must drive at least two required steps.`);
    if (!includes(draft.objectives[draft.interestHook!.objectiveIndex - 1], motif)) throw new Error('The interest reference must point to an interest-driven step.');
  }
  const blockerIndex = draft.blockerAdaptation.objectiveIndex - 1;
  const adapted = draft.objectives[blockerIndex];
  switch (context.setup.blocker) {
    case 'kids-reluctant': if (!/^(choose|pick|name|pretend|become|vote|invent)\b/i.test(draft.objectives[0])) throw new Error('Reluctant kids need a playful first choice.'); break;
    case 'tired':
      if (/\b(run|race|sprint|jog|climb|jump)\b/i.test(cardText)) throw new Error('Tired-family mission contains strenuous activity.');
      if (!/\b(slow|easy|rest|sit|stay|near|short|close)\b/i.test(adapted)) throw new Error('Tired-family step must visibly lower effort.');
      break;
    case 'short-time': if (!/\b(near|close|same spot|around|short|outside|home)\b/i.test(adapted)) throw new Error('Limited-time step must stay compact.'); break;
    case 'bad-weather':
      if (!/\b(covered|sheltered|shelter|under cover|doorway|awning|porch|brief outdoor|short outdoor)\b/i.test(adapted)) throw new Error('Bad-weather step must use shelter or brief outdoor time.');
      if (/\b(sunny|sunshine|clear sky|dry weather)\b/i.test(cardText)) throw new Error('Mission depends on fair weather.');
      break;
    case 'bored': if (!/\b(silly|strange|surprise|twist|new|unusual|secret|pretend|invent)\b/i.test(adapted)) throw new Error('Bored-family step needs a novel twist.'); break;
  }
  return draft;
}

export interface MissionModel { draft(prompt: string, signal: AbortSignal): Promise<unknown> }

export async function generateMission(model: MissionModel, context: MissionContext, signal: AbortSignal = new AbortController().signal): Promise<MissionDraft> {
  const { featured, secondary } = selectMissionInterests(context);
  const motif = featured ? motifFor(featured.interest) : null;
  const count = context.completedMissionCount ?? context.recentHistory.length;
  const childCount = context.participants.filter((person) => person.age < 18 && person.interests.length > 0).length;
  const options = questPlanOptionsFor(motif, count, childCount, context.recentHistory, context.type);
  const input = {
    missionType: context.type, blocker: context.setup.blocker, time: context.setup.timeBudget, travel: context.setup.distance,
    youngestAge: Math.min(...context.participants.map((person) => person.age)),
    featuredInterest: featured ? { name: featured.name, interest: featured.interest, motif } : null,
    secondaryChildInterest: secondary ? { name: secondary.name, interest: secondary.interest } : null,
    plans: options.map((plan, planChoice) => ({ planChoice, suggestedTitle: plan.title, premise: plan.premise, lastStep: plan.objectives[3], photoScene: plan.photo.sceneAnchor })),
    recent: context.recentHistory.slice(-5).map(({ title, type, rating }) => ({ title, type, rating })),
  };
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (signal.aborted) throw new MissionGenerationError('Mission generation was cancelled.');
    const start = performance.now();
    let raw: unknown;
    try {
      const prompt = `Choose an outdoor quest plan for this family. Return JSON {"planChoice":0,"title":"2 to 6 easy words"}; use 1 when you choose plan 1. Consider blocker, time, travel, interests, and recent ratings. Name only the chosen plan's real activity. Avoid brands, hype, subtitles, and new actions. Youngest child: ${input.youngestAge}. ${JSON.stringify(input)} ${feedback}`;
      raw = await model.draft(prompt, signal);
      const draftedMs = performance.now() - start;
      const validationStart = performance.now();
      const draft = validateMissionDraft(normalizeGenerated(raw, context, featured, options), context);
      console.info(`[SideQuest] generation attempt ${attempt}: model ${Math.round(draftedMs)}ms, validation ${Math.round(performance.now() - validationStart)}ms`);
      return draft;
    } catch (error) {
      console.info(`[SideQuest] generation attempt ${attempt} failed after ${Math.round(performance.now() - start)}ms: ${error instanceof Error ? error.message : String(error)}`);
      if (process.env.SIDEQUEST_DEBUG_MISSIONS === '1' && raw !== undefined) console.info(`[SideQuest] rejected draft: ${JSON.stringify(raw)}`);
      if (signal.aborted) throw new MissionGenerationError('Mission generation was cancelled.');
      feedback = `Fix this error from the last draft: ${error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240)}.`;
    }
  }
  throw new MissionGenerationError(`Gemma could not create a valid mission after two attempts. ${feedback}`);
}

export function createMastraMissionGenerator(config: AppConfig): MissionGenerator {
  const ollama = createOpenAI({ baseURL: `${config.ollamaBaseUrl.replace(/\/$/, '')}/v1`, apiKey: 'ollama' });
  const agent = new Agent({
    id: 'sidequest-agent', name: 'SideQuest',
    instructions: 'Choose one supplied family quest plan and write a short original title in simple English. Return exactly the requested JSON fields.',
    model: ollama(config.ollamaModel),
  });
  const model: MissionModel = {
    async draft(prompt, signal) {
      const result = await agent.generate<Generated>(prompt, { structuredOutput: { schema: generatedSchema, errorStrategy: 'strict' }, maxSteps: 1, abortSignal: signal });
      return result.object ?? JSON.parse(result.text);
    },
  };
  return async (context, signal = new AbortController().signal) => {
    try {
      const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/tags`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const tags = await response.json() as { models?: { name?: string }[] };
      if (!tags.models?.some((entry) => entry.name === config.ollamaModel)) throw new Error(`Model ${config.ollamaModel} is not installed.`);
    } catch (error) {
      if (signal.aborted) throw new MissionGenerationError('Mission generation was cancelled.');
      throw new MissionGenerationError(`Ollama is unavailable or the model is missing. Start Ollama and pull ${config.ollamaModel}, then retry. ${error instanceof Error ? error.message : String(error)}`);
    }
    return generateMission(model, context, signal);
  };
}
