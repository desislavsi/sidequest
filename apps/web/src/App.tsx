import { useEffect, useRef, useState } from 'react';
import type { ActiveMission, HistoryEntry, MissionRequest, Profile, ProfileInput } from '@sidequest/contracts';
import { api } from './api';
import { MissionCard } from './MissionCard';

type ProfileView = Profile & { level: number; rank: string; progressXp: number; nextLevelXp: number; unlocks: string[] };
type State = { profiles: ProfileView[]; activeMission: ActiveMission | null; history: HistoryEntry[]; streak: number; generating: boolean };
type Award = { name: string; xp: number; before: { level: number; rank: string }; after: { level: number; rank: string; progressXp: number; nextLevelXp: number } };
type Completion = { alreadyCompleted: boolean; historyEntry: HistoryEntry; awards: Award[]; streak: number };

const blockerOptions: { value: MissionRequest['blocker']; icon: string; label: string }[] = [
  { value: 'kids-reluctant', icon: '🎮', label: "Kids don't want to go" },
  { value: 'tired', icon: '😮‍💨', label: "I'm tired" },
  { value: 'short-time', icon: '⏱', label: "We don't have much time" },
  { value: 'bad-weather', icon: '☁', label: 'Bad weather' },
  { value: 'bored', icon: '✳', label: "We're bored" },
  { value: 'surprise', icon: '🎲', label: 'Surprise us' },
];
const timeOptions: { value: MissionRequest['timeBudget']; label: string }[] = [
  { value: '30m', label: '30 minutes' }, { value: '1h', label: '1 hour' }, { value: '2h+', label: '2+ hours' },
];
const distanceOptions: { value: MissionRequest['distance']; label: string }[] = [
  { value: 'outside', label: 'Right outside' }, { value: 'walk', label: 'Walking distance' }, { value: 'drive', label: 'We can drive' },
];

function ChoiceGroup<T extends string>({ title, options, value, onChange }: { title: string; options: { value: T; label: string; icon?: string }[]; value: T; onChange: (value: T) => void }) {
  return <fieldset className="choice-group"><legend>{title}</legend><div className="choice-row">{options.map((item) => <button type="button" className={`choice ${value === item.value ? 'selected' : ''}`} aria-pressed={value === item.value} key={item.value} onClick={() => onChange(item.value)}>{item.icon && <span>{item.icon}</span>}{item.label}</button>)}</div></fieldset>;
}

function ProfileEditor({ profile, onClose, onSave, onRemove }: { profile?: ProfileView; onClose: () => void; onSave: (input: ProfileInput) => Promise<void>; onRemove?: () => void }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(String(profile?.age ?? ''));
  const [interests, setInterests] = useState(profile?.interests.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError('');
    try { await onSave({ name: name.trim(), age: Number(age), interests: interests.split(',').map((item) => item.trim()).filter(Boolean) }); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save profile.'); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-label={profile ? 'Edit family member' : 'Add family member'}>
    <button className="dialog-close" onClick={onClose} aria-label="Close">×</button><div className="eyebrow">THE SQUAD</div><h2>{profile ? 'Edit family member' : 'Add family member'}</h2>
    <form onSubmit={submit}><label>Name or nickname<input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} required /></label><label>Age<input type="number" min="1" max="120" value={age} onChange={(event) => setAge(event.target.value)} required /></label><label>Interests <small>separate with commas</small><input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Gaming, nature, football" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save member'}</button></form>{onRemove && <button className="remove-button" onClick={onRemove}>Remove {profile?.name}</button>}
  </div></div>;
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const selectionInitialized = useRef(false);
  const [blocker, setBlocker] = useState<MissionRequest['blocker']>('kids-reluctant');
  const [timeBudget, setTimeBudget] = useState<MissionRequest['timeBudget']>('1h');
  const [distance, setDistance] = useState<MissionRequest['distance']>('walk');
  const [busy, setBusy] = useState(false);
  const [generationSlow, setGenerationSlow] = useState(false);
  const [cancellingGeneration, setCancellingGeneration] = useState(false);
  const generationAbort = useRef<AbortController | null>(null);
  const cancelRequested = useRef(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ProfileView | 'new' | null>(null);
  const [completing, setCompleting] = useState(false);
  const [bonusCompleted, setBonusCompleted] = useState(false);
  const [rating, setRating] = useState<'boring' | 'okay' | 'great'>('great');
  const [reward, setReward] = useState<Completion | null>(null);

  async function load() {
    const result = await api<State>('/api/state');
    setState(result);
    if (!selectionInitialized.current) {
      selectionInitialized.current = true;
      setSelected(result.profiles.slice(0, 6).map((profile) => profile.id));
    } else {
      setSelected((current) => current.filter((id) => result.profiles.some((profile) => profile.id === id)));
    }
  }
  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load SideQuest.')); }, []);
  useEffect(() => {
    if (!busy && !state?.generating) return;
    const timer = window.setInterval(() => load().catch(() => undefined), 1000);
    return () => window.clearInterval(timer);
  }, [busy, state?.generating]);

  async function createMission() {
    if (!selected.length) { setError('Choose at least one family member.'); return; }
    const controller = new AbortController();
    generationAbort.current = controller;
    cancelRequested.current = false;
    setBusy(true); setError(''); setGenerationSlow(false);
    const slowTimer = window.setTimeout(() => setGenerationSlow(true), 20_000);
    try { await api<ActiveMission>('/api/missions', 'POST', { participantIds: selected, blocker, timeBudget, distance }, controller.signal); await load(); }
    catch (caught) { if (!cancelRequested.current) setError(caught instanceof Error ? caught.message : 'Could not create a mission.'); }
    finally { generationAbort.current = null; window.clearTimeout(slowTimer); setGenerationSlow(false); setBusy(false); }
  }
  async function cancelGeneration() {
    setCancellingGeneration(true); setError('');
    try {
      await api('/api/missions/generation', 'DELETE');
      cancelRequested.current = true;
      generationAbort.current?.abort();
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not cancel generation.'); }
    finally { setCancellingGeneration(false); }
  }
  async function discardMission() {
    if (!window.confirm('Discard this mission and return to setup?')) return;
    setBusy(true); setError('');
    try { await api('/api/missions/active', 'DELETE'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not discard mission.'); }
    finally { setBusy(false); }
  }
  async function completeMission() {
    if (!state?.activeMission) return;
    setBusy(true); setError('');
    try { const result = await api<Completion>(`/api/missions/${state.activeMission.id}/complete`, 'POST', { bonusCompleted, rating }); setReward(result); setCompleting(false); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not complete mission.'); }
    finally { setBusy(false); }
  }
  async function saveProfile(input: ProfileInput) {
    if (editing && editing !== 'new') await api(`/api/profiles/${editing.id}`, 'PATCH', input);
    else await api('/api/profiles', 'POST', input);
    await load();
  }
  async function removeProfile(profile: ProfileView) {
    if (!window.confirm(`Remove ${profile.name} from the family?`)) return;
    try { await api(`/api/profiles/${profile.id}`, 'DELETE'); await load(); setEditing(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove profile.'); }
  }

  return <div className="app-shell">
    <header className="site-header"><div className="site-logo">SIDE<span>QUEST</span><i>✦</i></div><div className="header-right"><span className="local-badge"><span /> LOCAL AI</span><span className="streak-badge">🔥 <strong>{state?.streak ?? 0}</strong> DAY STREAK</span></div></header>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {!state ? <main className="loading-screen"><div className="spinner" /><p>Opening SideQuest…</p><button onClick={() => load().catch((caught) => setError(String(caught)))}>Retry</button></main> : reward ? <main className="reward-view">
      <div className="reward-spark">✦</div><div className="eyebrow">QUEST LOG UPDATED</div><h1>MISSION<br /><em>COMPLETE!</em></h1><p className="reward-sub">You made a story worth telling. Here’s what the squad earned.</p>
      <div className="reward-grid">{reward.awards.map((award) => <div className="reward-card" key={award.name}><strong>{award.name}</strong><span>+{award.xp} XP</span>{award.after.level > award.before.level ? <div className="level-up">⬆ LEVEL UP!<small>Level {award.before.level} → {award.after.level} · {award.after.rank}</small></div> : <div className="reward-progress"><div className="progress-track"><div style={{ width: `${award.after.progressXp / award.after.nextLevelXp * 100}%` }} /></div><small>{award.after.progressXp} / {award.after.nextLevelXp} XP TO NEXT LEVEL</small></div>}</div>)}</div>
      <div className="reward-streak">🔥 FAMILY STREAK: {reward.streak}</div><button className="primary-button large" onClick={() => setReward(null)}>PLAN THE NEXT SIDEQUEST <span>→</span></button>
    </main> : state.activeMission ? <main className="mission-view">
      <div className="mission-layout"><aside className="handoff-panel"><div className="side-kicker">MISSION READY <span>●</span></div><h2>The world<br />is waiting.</h2><p>Everything you need is right here on the card. Take it with you, then go make the story real.</p><div className="handoff-tip"><div className="tip-icon">📱</div><strong>TAKE A PHOTO</strong><span>Photograph this mission card with your phone. That’s all you need outside.</span></div><div className="handoff-tip"><div className="tip-icon">🖨</div><strong>OR PRINT IT</strong><span>Prefer a screenless adventure? Print the same card on A4.</span></div></aside>
        <MissionCard mission={state.activeMission} />
        <aside className="mission-actions"><div><div className="side-kicker">YOUR HANDOFF</div><h2>Ready,<br />set, go.</h2><p>Leave the screen behind. Your quest starts at the front door.</p><button className="outline-button" onClick={() => window.print()}>🖨 &nbsp; PRINT MISSION</button></div><div className="return-actions"><p>Back from your adventure?</p><button className="primary-button" onClick={() => setCompleting(true)}>COMPLETE MISSION <span>→</span></button><button className="text-button" disabled={busy} onClick={discardMission}>Discard this mission</button></div></aside>
      </div>
    </main> : <main className="home-view">
      <div className="home-hero"><div><div className="eyebrow">REAL-WORLD ADVENTURES, MADE FOR YOUR FAMILY <span>✦</span></div><h1>GET US <em>OUT.</em></h1><p>Turn “we should get out of the house, but…” into a mission they’ll actually want to do.</p></div><div className="hero-doodle" aria-hidden="true"><span className="doodle-sun">✳</span><span className="doodle-path">↝</span><span className="doodle-flag">⚑</span></div></div>
      <section className="setup-panel"><div className="section-heading"><div><span className="section-number">01</span><h2>Who's going?</h2></div><button className="subtle-button" onClick={() => setEditing('new')}>＋ ADD FAMILY MEMBER</button></div><div className="profiles-row">{state.profiles.map((profile) => <div className={`profile-card ${selected.includes(profile.id) ? 'active' : ''}`} key={profile.id}><button className="profile-select" aria-pressed={selected.includes(profile.id)} onClick={() => setSelected((current) => current.includes(profile.id) ? current.filter((id) => id !== profile.id) : current.length < 6 ? [...current, profile.id] : current)}><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><span className="profile-info"><strong>{profile.name}</strong><small>LVL {profile.level} · {profile.rank}</small></span><span className="profile-check">✓</span></button><div className="profile-bottom"><div className="progress-track"><div style={{ width: `${profile.progressXp / profile.nextLevelXp * 100}%` }} /></div><span>{profile.progressXp} / {profile.nextLevelXp} XP</span><button onClick={() => setEditing(profile)} aria-label={`Edit ${profile.name}`}>EDIT</button></div><p>{profile.interests.join(' · ') || 'Add interests'}</p></div>)}</div></section>
      <section className="setup-panel choices-panel"><div className="section-heading"><div><span className="section-number">02</span><h2>What's stopping you?</h2></div></div><ChoiceGroup title="CHOOSE YOUR BLOCKER" options={blockerOptions} value={blocker} onChange={setBlocker} /><div className="details-grid"><ChoiceGroup title="HOW MUCH TIME?" options={timeOptions} value={timeBudget} onChange={setTimeBudget} /><ChoiceGroup title="HOW FAR?" options={distanceOptions} value={distance} onChange={setDistance} /></div></section>
      <div className="launch-row"><div><strong>ONE CLICK. ONE QUEST. A WHOLE NEW STORY.</strong><span>Made locally with Gemma. Made real by your family.</span></div><button className="launch-button" disabled={busy || state.generating || !selected.length} onClick={createMission}>{busy || state.generating ? generationSlow ? 'GEMMA IS STILL CREATING…' : 'CREATING YOUR SIDEQUEST LOCALLY…' : 'GET US OUT'} <span>↗</span></button></div>
      {(busy || state.generating) && <div className="generation-note" role="status"><span>{cancellingGeneration ? 'Stopping local generation…' : generationSlow || state.generating ? 'Gemma is still creating your mission locally. You can keep waiting or cancel.' : 'Creating a quest that fits your family and today’s blocker…'}</span><button type="button" disabled={cancellingGeneration || !state.generating} onClick={cancelGeneration}>CANCEL GENERATION</button></div>}
      {state.history.length > 0 && <section className="history-section"><h2>PAST ADVENTURES</h2><div>{state.history.slice(0, 5).map((item) => <div className="history-item" key={item.id}><strong>{item.title}</strong><span>{item.date} · {item.participants.join(', ')}</span><b>{item.rating === 'great' ? '★ GREAT!' : item.rating.toUpperCase()}</b></div>)}</div></section>}
    </main>}
    {editing && <ProfileEditor profile={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={saveProfile} onRemove={editing !== 'new' && !state?.activeMission ? () => removeProfile(editing) : undefined} />}
    {completing && state?.activeMission && <div className="dialog-backdrop"><div className="dialog completion-dialog" role="dialog" aria-modal="true" aria-label="Complete mission"><button className="dialog-close" onClick={() => setCompleting(false)} aria-label="Close">×</button><div className="eyebrow">WELCOME BACK, SQUAD</div><h2>Mission complete?</h2><p>Confirm the quest, then tell us how it went. No proof needed.</p><div className="dialog-group"><strong>BONUS OBJECTIVE</strong><div className="dialog-choice-row"><button className={bonusCompleted ? 'selected' : ''} onClick={() => setBonusCompleted(true)}>Yes, we did it</button><button className={!bonusCompleted ? 'selected' : ''} onClick={() => setBonusCompleted(false)}>Not this time</button></div></div><div className="dialog-group"><strong>HOW WAS IT?</strong><div className="dialog-choice-row">{(['boring', 'okay', 'great'] as const).map((option) => <button className={rating === option ? 'selected' : ''} key={option} onClick={() => setRating(option)}>{option === 'great' ? 'Great!' : option === 'okay' ? 'Okay' : 'Boring'}</button>)}</div></div><button className="primary-button" disabled={busy} onClick={completeMission}>{busy ? 'Saving…' : 'CONFIRM MISSION COMPLETE'}</button></div></div>}
  </div>;
}
