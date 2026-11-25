// which judges are judging an event (not every event has 2 judges). Default: Judge 1 only.
const k = (id) => `sparkleJudges:${id}`
export function getJudges(eventId) {
  try { const v = JSON.parse(localStorage.getItem(k(eventId))); if (Array.isArray(v) && v.length) return v } catch { /* ignore */ }
  return ['1']
}
export function setJudges(eventId, list) { try { localStorage.setItem(k(eventId), JSON.stringify(list)) } catch { /* ignore */ } }
