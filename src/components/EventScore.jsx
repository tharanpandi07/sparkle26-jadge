import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, FileSpreadsheet, Info, RefreshCw, Save, Search, UserCheck, Zap } from 'lucide-react'
import { api } from '../api'
import { downloadScoresExcel } from '../exportExcel'
import { getJudges, setJudges } from '../judges'
import '../styles/event.css'

const POLL_MS = 8000
const round2 = (v) => Math.round(v * 100) / 100
const EMPTY_SPEC = { criteria: [], weights: null, maxTotal: 0, note: '', minTeam: 0, maxTeam: 0 }

// same rule as ScoringConfig.Spec.total() on the server
export function computeTotal(spec, marks) {
  const { criteria, weights } = spec
  if (!weights) return round2(criteria.reduce((s, c) => s + (marks[c.key] ?? 0), 0))
  let t = 0
  for (const [g, w] of Object.entries(weights)) {
    let got = 0, max = 0
    criteria.forEach((c) => { if (c.group === g) { max += c.max; got += marks[c.key] ?? 0 } })
    if (max > 0) t += (got / max) * 100 * w
  }
  return round2(t)
}

// standard competition ranking on the average mark (1,2,2,4 ...)
function withRanks(entries) {
  const scored = entries.filter((e) => e.average != null).sort((a, b) => b.average - a.average)
  const rank = new Map()
  scored.forEach((e, i) => rank.set(e.key, i > 0 && scored[i - 1].average === e.average ? rank.get(scored[i - 1].key) : i + 1))
  return entries.map((e) => ({ ...e, rank: rank.get(e.key) || null }))
}

export default function EventScore({ accessKey, event, onBack, onAuthFail }) {
  const [entries, setEntries] = useState([])
  const [spec, setSpec] = useState(EMPTY_SPEC)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('1') // '1' = Judge 1, '2' = Judge 2, 'all' = results
  const [query, setQuery] = useState('')
  const [presentOnly, setPresentOnly] = useState(false)
  const [drafts, setDrafts] = useState({}) // "<entryKey>|<judge>" -> { marks: {criterionKey: "text"}, remarks }
  const [saving, setSaving] = useState('')
  const [savedFlash, setSavedFlash] = useState('')
  const [judges, setJudgesState] = useState(() => getJudges(event.id))
  const [updatedAt, setUpdatedAt] = useState(null)
  const [newKeys, setNewKeys] = useState(() => new Set())
  const seen = useRef(null)
  const authFail = useRef(onAuthFail)
  authFail.current = onAuthFail

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const d = await api(`/api/scorecard/events/${event.id}`, { key: accessKey })
      const list = Array.isArray(d.entries) ? d.entries : []
      // on-spot / late registrations that appear while the page is open get a NEW badge
      if (seen.current === null) seen.current = new Set(list.map((e) => e.key))
      else {
        const fresh = list.filter((e) => !seen.current.has(e.key)).map((e) => e.key)
        if (fresh.length) { fresh.forEach((k) => seen.current.add(k)); setNewKeys((s) => new Set([...s, ...fresh])) }
      }
      setSpec({ criteria: d.criteria || [], weights: d.weights || null, maxTotal: d.maxTotal || 0, note: d.note || '', minTeam: d.minTeam || 0, maxTeam: d.maxTeam || 0 })
      setEntries(list)
      setUpdatedAt(new Date())
      setError('')
    } catch (e) {
      if (e.status === 401) authFail.current()
      else setError(e.message === 'Failed to fetch' ? 'Cannot connect to the backend.' : e.message)
    } finally { setLoading(false) }
  }, [accessKey, event.id])

  useEffect(() => { seen.current = null; setNewKeys(new Set()); load() }, [load])
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true) }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const ranked = useMemo(() => withRanks(entries), [entries])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ranked.filter((e) => {
      if (presentOnly && !e.present) return false
      if (!q) return true
      return [e.name, e.teamName, e.college, e.department, ...e.members.flatMap((m) => [m.name, m.email, m.phone, m.ticketCode])]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [ranked, query, presentOnly])

  // round headers (Round 1 / Round 2 ...) above the criteria columns
  const groups = useMemo(() => {
    if (!spec.criteria.some((c) => c.group)) return null
    const out = []
    spec.criteria.forEach((c) => { const l = out[out.length - 1]; if (l && l.name === c.group) l.count++; else out.push({ name: c.group, count: 1 }) })
    return out
  }, [spec])

  const presentCount = entries.filter((e) => e.present).length
  const j1Done = entries.filter((e) => e.judge1 != null).length
  const j2Done = entries.filter((e) => e.judge2 != null).length
  const overview = tab === 'all' ? [...filtered].sort((a, b) => (a.rank || 9999) - (b.rank || 9999) || a.name.localeCompare(b.name)) : filtered
  const perJudgeMax = spec.maxTotal
  // a judge stays visible if he already has saved marks, even when unticked
  const on1 = judges.includes('1') || j1Done > 0
  const on2 = judges.includes('2') || j2Done > 0
  const judgeCount = (on1 ? 1 : 0) + (on2 ? 1 : 0)
  function toggleJudge(n) {
    const next = new Set(judges)
    if (next.has(n)) next.delete(n); else next.add(n)
    if (!next.size) return // at least one judge
    const arr = [...next].sort(); setJudgesState(arr); setJudges(event.id, arr)
  }
  useEffect(() => { if (tab === '1' && !on1) setTab('2'); else if (tab === '2' && !on2) setTab('1') }, [tab, on1, on2])
  const sizeBad = (e) => spec.maxTeam > 0 && (e.teamSize > spec.maxTeam || e.teamSize < spec.minTeam)
  const sizeText = spec.maxTeam ? (spec.minTeam === spec.maxTeam ? `${spec.maxTeam}` : `${spec.minTeam}–${spec.maxTeam}`) : ''

  // ---- drafts / save ----
  const dk = (key, j) => `${key}|${j}`
  const serverMarks = (e, j) => (j === '1' ? e.marks1 : e.marks2) || {}
  const serverRem = (e, j) => (j === '1' ? e.remarks1 : e.remarks2) || ''
  const draftOf = (e, j) => drafts[dk(e.key, j)]
  const markShown = (e, j, c) => { const d = draftOf(e, j); if (d && c.key in d.marks) return d.marks[c.key]; const v = serverMarks(e, j)[c.key]; return v == null ? '' : v }
  const remShown = (e, j) => draftOf(e, j)?.remarks ?? serverRem(e, j)
  const setMark = (e, j, c, value) => setDrafts((d) => { const cur = d[dk(e.key, j)] || { marks: {} }; return { ...d, [dk(e.key, j)]: { ...cur, marks: { ...cur.marks, [c.key]: value } } } })
  const setRemark = (e, j, value) => setDrafts((d) => { const cur = d[dk(e.key, j)] || { marks: {} }; return { ...d, [dk(e.key, j)]: { ...cur, remarks: value } } })
  const isDirty = (e, j) => {
    const d = draftOf(e, j)
    if (!d) return false
    const sm = serverMarks(e, j)
    return Object.entries(d.marks).some(([k, v]) => String(v) !== String(sm[k] ?? '')) || (d.remarks !== undefined && d.remarks !== serverRem(e, j))
  }
  const currentMarks = (e, j) => {
    const out = {}
    spec.criteria.forEach((c) => { const v = String(markShown(e, j, c)).trim(); if (v !== '' && !Number.isNaN(Number(v))) out[c.key] = Number(v) })
    return out
  }
  const liveTotal = (e, j) => { const m = currentMarks(e, j); return Object.keys(m).length ? computeTotal(spec, m) : null }

  async function save(e, j) {
    const marks = {}
    for (const c of spec.criteria) {
      const raw = String(markShown(e, j, c)).trim()
      if (raw === '') continue
      const n = Number(raw)
      if (Number.isNaN(n) || n < 0 || n > c.max) { setError(`${c.label} must be between 0 and ${c.max}.`); return }
      marks[c.key] = n
    }
    const id = dk(e.key, j)
    setSaving(id); setError('')
    try {
      await api('/api/scorecard/score', { method: 'POST', key: accessKey, body: JSON.stringify({ entryKey: e.key, eventId: event.id, judgeNo: Number(j), marks, remarks: remShown(e, j) }) })
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n })
      await load(true)
      setSavedFlash(id); setTimeout(() => setSavedFlash((f) => (f === id ? '' : f)), 1500)
    } catch (err) {
      if (err.status === 401) authFail.current(); else setError(err.message === 'Failed to fetch' ? 'Cannot connect to the backend.' : err.message)
    } finally { setSaving('') }
  }

  const memberLine = (e) => e.members.map((m) => m.name).join(', ')

  return (
    <section className="ev-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All events</button>

      <div className="ev-head">
        <div>
          <span className="mini-label">{event.level.toUpperCase()} · {event.category.toUpperCase()}</span>
          <h1><span>{event.icon}</span> {event.title}</h1>
          <p>{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {presentCount} present {sizeText ? ` · team size ${sizeText}` : ''} · each judge marks out of {perJudgeMax} · auto-refreshing{updatedAt ? ` (last ${updatedAt.toLocaleTimeString()})` : ''}</p>
        </div>
        <div className="ev-actions">
          <button className="secondary-btn" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          <button className="primary-btn" onClick={() => downloadScoresExcel(event, spec, withRanks(entries).sort((a, b) => (a.rank || 9999) - (b.rank || 9999)), on2)} disabled={!entries.length}><FileSpreadsheet size={16} /> Excel</button>
        </div>
      </div>

      {spec.note && <div className="ev-note"><Info size={15} /> {spec.note}</div>}

      <div className="judge-pick">
        <span>Judges for this event:</span>
        <label className="ev-check"><input type="checkbox" checked={on1} disabled={j1Done > 0 || (on1 && !on2)} onChange={() => toggleJudge('1')} /> Judge 1</label>
        <label className="ev-check"><input type="checkbox" checked={on2} disabled={j2Done > 0 || (on2 && !on1)} onChange={() => toggleJudge('2')} /> Judge 2</label>
      </div>

      <div className="judge-tabs">
        {on1 && <button className={tab === '1' ? 'jt active' : 'jt'} onClick={() => setTab('1')}>Judge 1 <em>{j1Done}/{entries.length}</em></button>}
        {on2 && <button className={tab === '2' ? 'jt active' : 'jt'} onClick={() => setTab('2')}>Judge 2 <em>{j2Done}/{entries.length}</em></button>}
        <button className={tab === 'all' ? 'jt active' : 'jt'} onClick={() => setTab('all')}>Results &amp; ranking</button>
      </div>

      <div className="ev-toolbar">
        <div className="ev-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, team, college, ticket…" /></div>
        <label className="ev-check"><input type="checkbox" checked={presentOnly} onChange={(e) => setPresentOnly(e.target.checked)} /> Present only</label>
        <span className="ev-count">{filtered.length} of {entries.length}</span>
      </div>

      {error && <p className="app-error">{error}</p>}

      {loading && !entries.length ? <div className="empty-box">Loading participants…</div>
        : !filtered.length ? <div className="empty-box">{entries.length ? 'No participants match your filter.' : 'No participants registered for this event yet. New on-spot registrations will appear here automatically.'}</div>
        : tab === 'all' ? (
          <div className="table-wrap">
            <table className="sc-table">
              <thead><tr><th>RANK</th><th>PARTICIPANT / TEAM</th><th>COLLEGE</th>{on1 && <th>JUDGE 1 /{perJudgeMax}</th>}{on2 && <th>JUDGE 2 /{perJudgeMax}</th>}{judgeCount > 1 && <th>TOTAL</th>}<th>{judgeCount > 1 ? 'AVERAGE' : 'SCORE'} /{perJudgeMax}</th></tr></thead>
              <tbody>
                {overview.map((e) => (
                  <tr key={e.key} className={e.rank && e.rank <= 3 ? `podium p${e.rank}` : ''}>
                    <td>{e.rank ? <span className="rank-badge">{e.rank}</span> : '—'}</td>
                    <td><b>{e.name}</b>{e.team && <small>{memberLine(e)}</small>}{sizeBad(e) && <span className="size-warn">⚠ {e.teamSize} members (allowed {sizeText})</span>}</td>
                    <td>{e.college}<small>{e.department} · {e.year}</small></td>
                    {on1 && <td className="num">{e.judge1 ?? '—'}</td>}
                    {on2 && <td className="num">{e.judge2 ?? '—'}</td>}
                    {judgeCount > 1 && <td className="num">{e.total ?? '—'}</td>}
                    <td className="num strong">{e.average ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="sc-table marks-table">
              <thead>
                {groups && (
                  <tr className="group-row">
                    <th colSpan={4} />
                    {groups.map((g) => <th key={g.name} colSpan={g.count} className="group-cell">{g.name}</th>)}
                    <th colSpan={3} />
                  </tr>
                )}
                <tr>
                  <th>#</th><th>PARTICIPANT / TEAM</th><th>COLLEGE</th><th>STATUS</th>
                  {spec.criteria.map((c) => <th key={c.key} className="crit-th">{c.label}<span>/ {c.max}</span></th>)}
                  <th className="crit-th">TOTAL<span>/ {perJudgeMax}</span></th><th>REMARKS</th><th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const id = dk(e.key, tab), dirty = isDirty(e, tab), tot = liveTotal(e, tab)
                  return (
                    <tr key={e.key} className={newKeys.has(e.key) ? 'is-new' : ''}>
                      <td className="idx">{i + 1}</td>
                      <td>
                        <b>{e.name}</b>
                        {newKeys.has(e.key) && <span className="new-badge"><Zap size={11} /> NEW</span>}
                        {e.team ? <small>Team of {e.teamSize} · {memberLine(e)}</small> : <small>{e.members[0]?.ticketCode}</small>}
                        {sizeBad(e) && <span className="size-warn">⚠ {e.teamSize} members (allowed {sizeText})</span>}
                      </td>
                      <td>{e.college}<small>{e.department} · {e.year}</small></td>
                      <td>
                        {e.present ? <span className="st present"><UserCheck size={13} /> Present</span> : <span className="st absent">Not arrived</span>}
                        {e.source === 'ONSPOT' && <span className="st onspot">On-spot</span>}
                      </td>
                      {spec.criteria.map((c) => (
                        <td key={c.key}>
                          <input className="mark-input" type="number" inputMode="decimal" min="0" max={c.max} step="0.5" value={markShown(e, tab, c)}
                            onChange={(ev) => setMark(e, tab, c, ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') save(e, tab) }} placeholder="—" />
                        </td>
                      ))}
                      <td className="num total-cell">{tot ?? '—'}</td>
                      <td><input className="rem-input" value={remShown(e, tab)} maxLength={300} onChange={(ev) => setRemark(e, tab, ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') save(e, tab) }} placeholder="Optional" /></td>
                      <td>
                        <button className={`save-btn${dirty ? ' dirty' : ''}`} disabled={!dirty || saving === id} onClick={() => save(e, tab)}>
                          {savedFlash === id ? <><Check size={14} /> Saved</> : saving === id ? '…' : <><Save size={14} /> Save</>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
