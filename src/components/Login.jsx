import { useState } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import '../styles/login.css'

export default function Login({ onLogin, error }) {
  const [key, setKey] = useState('')
  return (
    <div className="login-screen">
      <img src="/hero.png" className="login-bg-image" alt="" />
      <div className="login-bg-overlay" />
      <div className="login-art">
        <img src="/sparkle-logo.png" alt="SPARKLE 26" className="login-logo" />
        <p className="eyebrow">IDEAS IGNITE TOMORROW</p>
        <h1>Every score<br /><em>tells a story.</em></h1>
        <p className="login-copy">Judges scorecard for SPARKLE'26 — pick your event, see every participant, enter the marks.</p>
      </div>
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); onLogin(key.trim()) }}>
        <span className="mini-label">JUDGE ACCESS</span>
        <h2>Welcome, judge</h2>
        <p>Enter the scorecard access key provided by your event administrator.</p>
        <label>Scorecard access key</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter your access key" required autoComplete="current-password" />
        {error && <div className="inline-error">{error}</div>}
        <button type="submit" className="primary-btn">Continue <ArrowRight size={17} /></button>
        <small><ShieldCheck size={14} /> Protected event operations</small>
      </form>
    </div>
  )
}
