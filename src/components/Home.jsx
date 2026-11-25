import { useState } from 'react'
import { ChevronRight, GraduationCap, School, Users } from 'lucide-react'
import { getJudges } from '../judges'
import '../styles/home.css'

const LEVELS = [
  { id: 'senior', label: 'Senior events', sub: 'College students', icon: GraduationCap },
  { id: 'junior', label: 'Junior events', sub: 'School students', icon: School }
]

export default function Home({ events, counts, onOpen }) {
  const [level, setLevel] = useState('senior')
  const list = events.filter((e) => e.level === level)
  const total = (lv) => events.filter((e) => e.level === lv).length

  return (
    <section>
      <div className="home-head">
        <span className="mini-label">SCORECARD</span>
        <h1>Choose an event</h1>
        <p>Open your event to see the participant list and enter Judge 1 / Judge 2 marks.</p>
      </div>

      <div className="level-tabs">
        {LEVELS.map((l) => {
          const Icon = l.icon
          return (
            <button key={l.id} className={level === l.id ? 'level-tab active' : 'level-tab'} onClick={() => setLevel(l.id)}>
              <Icon size={20} />
              <div><b>{l.label}</b><small>{l.sub}</small></div>
              <span className="level-count">{total(l.id) || '–'}</span>
            </button>
          )
        })}
      </div>

      {!events.length && <div className="empty-box">Loading events…</div>}

      <div className="event-grid">
        {list.map((ev) => {
          const c = counts[ev.id] || { entries: 0, present: 0, scoredJudge1: 0, scoredJudge2: 0 }
          const two = getJudges(ev.id).includes('2') || c.scoredJudge2 > 0
          const pct = (n) => (c.entries ? Math.round((n / c.entries) * 100) : 0)
          return (
            <button key={ev.id} className="event-card" onClick={() => onOpen(ev.id)}>
              <div className="event-card-top">
                <span className="event-icon">{ev.icon || '🏆'}</span>
                <span className={`cat-chip ${ev.category === 'technical' ? 'tech' : 'non'}`}>{ev.category}</span>
              </div>
              <h3>{ev.title}</h3>
              <div className="event-meta"><Users size={14} /> {c.entries} {c.entries === 1 ? 'entry' : 'entries'} · {c.present} present</div>
              <div className="judge-progress">
                <div><span>Judge 1</span><i><u style={{ width: `${pct(c.scoredJudge1)}%` }} /></i><em>{c.scoredJudge1}/{c.entries}</em></div>
                {two && <div><span>Judge 2</span><i><u style={{ width: `${pct(c.scoredJudge2)}%` }} /></i><em>{c.scoredJudge2}/{c.entries}</em></div>}
              </div>
              <span className="event-open">Open scorecard <ChevronRight size={16} /></span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
