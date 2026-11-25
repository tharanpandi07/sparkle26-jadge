const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.key ? { 'X-Scorecard-Key': options.key } : {}), ...(options.headers || {}) }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) { const e = new Error(data.message || `Request failed (${response.status})`); e.status = response.status; throw e }
  return data
}
