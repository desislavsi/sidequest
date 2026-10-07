import type { ActiveMission } from '@sidequest/contracts';

const typeLabels: Record<ActiveMission['type'], string> = {
  basic: 'FIELD MISSION', treasure: 'TREASURE HUNT', adventure: 'ADVENTURE', mystery: 'MYSTERY', epic: 'EPIC QUEST',
};

export function MissionCard({ mission }: { mission: ActiveMission }) {
  return <article className="mission-card" aria-label="Mission card">
    <div className="card-topline"><span className="brand-mark">SIDE<span>QUEST</span><i>✦</i></span><span className="card-edition">YOUR NEXT STORY STARTS OUTSIDE</span></div>
    <div className="card-heading">
      <div className="eyebrow">MISSION FILE <span className="line" /> {typeLabels[mission.type]}</div>
      <h1>{mission.title}</h1>
      <div className="mission-stats"><span>{'★'.repeat(mission.difficulty)}{'☆'.repeat(3 - mission.difficulty)} <small>DIFFICULTY</small></span><span>{mission.durationMinutes} MIN</span><span>{mission.baseXp} XP</span></div>
    </div>
    <div className="card-body">
      <section className="squad-block"><h2>THE SQUAD</h2><div className="squad-list">{mission.participants.map((person) => <span key={person.id}>{person.name} <b>L{person.level}</b></span>)}</div></section>
      <section className="story-block"><h2>YOUR MISSION</h2><p>{mission.premise}</p></section>
      <section className="objectives-block"><h2>OBJECTIVES <span>CHECK THEM OFF AS YOU GO</span></h2><ol>{mission.objectives.map((objective, index) => <li key={index}><span className="paper-checkbox" aria-hidden="true" /><span>{objective}</span></li>)}</ol></section>
      <div className="card-footer-grid">
        <section className="memory-block"><h2>📸 MAIN OBJECTIVE <span>YOUR FAMILY PHOTO</span></h2><div className="memory-line"><span className="paper-checkbox" aria-hidden="true" /><p>{mission.memoryMoment.text}</p></div></section>
        <section className="bonus-block"><h2>✦ BONUS OBJECTIVE <span>+50 XP</span></h2><div className="bonus-line"><span className="paper-checkbox" aria-hidden="true" /><p>{mission.bonus}</p></div></section>
      </div>
    </div>
    <div className="card-bottomline"><span>THE WORLD IS YOUR PLAYGROUND</span><strong>+{mission.baseXp} XP <small>ON COMPLETION</small></strong></div>
  </article>;
}
