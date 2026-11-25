import { useCallback, useEffect, useState } from 'react'
import { LogOut, Trophy } from 'lucide-react'
import { api } from './api'
import Login from './components/Login'
import Home from './components/Home'
import EventScore from './components/EventScore'
import './styles/global.css'

const KEY = 'sparkleScorecardKey'

export default function App() {
  const [key, setKey] = useState(sessionStorage.getItem(KEY) || '')
  const [error, setError] = useState('')
  const [eventId, setEventId] = useState(null)
  const [events, setEvents] = useState([])
  const [counts, setCounts] = useState({})

  const loadCounts = useCallback(async (k = key) => {
    const rows = await api('/api/scorecard/summary', { key: k })
    setCounts(Object.fromEntries((Array.isArray(rows) ? rows : []).map((r) => [r.eventId, r])))
  }, [key])

  function logout() { sessionStorage.removeItem(KEY); setKey(''); setEventId(null); setCounts({}) }

  async function login(value) {
    setError('')
    try {
      await loadCounts(value)
      sessionStorage.setItem(KEY, value)
      setKey(value)
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Cannot connect to the backend. Make sure Spring Boot is running.' : 'Invalid scorecard access key. Check the key with the event administrator.')
    }
  }

  // already logged in (page refresh) -> verify the key again
  useEffect(() => { if (key) loadCounts(key).catch(() => logout()) }, []) // eslint-disable-line

  useEffect(() => {
    if (!key) return
    api('/api/events').then((d) => setEvents(Array.isArray(d) ? d : [])).catch(() => {})
  }, [key])

  // keep the event cards' numbers fresh (new on-spot registrations, new scores)
  useEffect(() => {
    if (!key || eventId) return
    const t = setInterval(() => loadCounts().catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [key, eventId, loadCounts])

  if (!key) return <Login onLogin={login} error={error} />

  const current = events.find((e) => e.id === eventId)

  return (
    <div className="sc-shell">
      <header className="sc-top">
        <button className="sc-brand" onClick={() => { setEventId(null); loadCounts().catch(() => {}) }}>
          <b>S<span>26</span></b>
          <div>SPARKLE'26<small>JUDGES SCORECARD</small></div>
        </button>
        <div className="sc-top-right">
          <span className="live-pill"><i /> LIVE</span>
          <button className="secondary-btn sc-signout" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </header>
      <main className="sc-main">
        {eventId && current
          ? <EventScore accessKey={key} event={current} onBack={() => { setEventId(null); loadCounts().catch(() => {}) }} onAuthFail={logout} />
          : <Home events={events} counts={counts} onOpen={setEventId} />}
      </main>
      <footer className="sc-footer"><Trophy size={13} /> SPARKLE'26 <span>·</span> OFFICIAL EVENT MANAGEMENT</footer>
    </div>
  )
}
