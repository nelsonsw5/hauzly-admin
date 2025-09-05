import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function toDateMaybe(value) {
  if (!value) return null
  if (value?.toDate) {
    try { return value.toDate() } catch { /* noop */ }
  }
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDateTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
}

function formatTimeRange(start, end) {
  if (start && end) return `${formatTime(start)}–${formatTime(end)}`
  if (start) return `${formatTime(start)}–—`
  if (end) return `—–${formatTime(end)}`
  return '—'
}

function deriveRouteTimes(route) {
  const startCandidates = []
  const endCandidates = []

  const routeStartRaw = route.startTimeLocal || route.startTime || route.start_at || route.routeStart || route.start
  const routeEndRaw = route.endTimeLocal || route.endTime || route.end_at || route.routeEnd || route.end
  const routeStart = toDateMaybe(routeStartRaw)
  const routeEnd = toDateMaybe(routeEndRaw)
  if (routeStart) startCandidates.push(routeStart)
  if (routeEnd) endCandidates.push(routeEnd)

  if (Array.isArray(route.pickups)) {
    route.pickups.forEach(p => {
      const pStart = toDateMaybe(p?.scheduledWindowStart || p?.scheduledTimeLocal || p?.scheduledTime)
      const pEnd = toDateMaybe(p?.scheduledWindowEnd || p?.scheduledTimeLocal || p?.scheduledTime)
      if (pStart) startCandidates.push(pStart)
      if (pEnd) endCandidates.push(pEnd)
    })
  }

  const routeStartFinal = startCandidates.length ? new Date(Math.min(...startCandidates.map(d => d.getTime()))) : null
  const routeEndFinal = endCandidates.length ? new Date(Math.max(...endCandidates.map(d => d.getTime()))) : null
  return { routeStart: routeStartFinal, routeEnd: routeEndFinal }
}

function statusPillColor(status) {
  const s = (status || '').toString().toLowerCase()
  if (['complete', 'completed', 'done'].includes(s)) return '#16a34a'
  if (['active', 'in_progress', 'in-progress', 'ongoing'].includes(s)) return '#0284c7'
  if (['scheduled', 'pending', 'upcoming'].includes(s)) return '#a16207'
  if (['cancelled', 'canceled', 'failed'].includes(s)) return '#dc2626'
  return '#475569'
}

function Dashboard() {
  const [routes, setRoutes] = useState([])
  const [pickups, setPickups] = useState([])
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [loadingPickups, setLoadingPickups] = useState(true)
  const [errorRoutes, setErrorRoutes] = useState('')
  const [errorPickups, setErrorPickups] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      setLoadingRoutes(true)
      setErrorRoutes('')
      try {
        const snap = await getDocs(collection(db, 'routes'))
        if (cancelled) return
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setRoutes(all)
      } catch (err) {
        if (!cancelled) setErrorRoutes(err?.message || 'Failed to load routes')
      } finally {
        if (!cancelled) setLoadingRoutes(false)
      }
    }

    async function loadPickups() {
      setLoadingPickups(true)
      setErrorPickups('')
      try {
        const snap = await getDocs(collection(db, 'pickups'))
        if (cancelled) return
        const basePickups = snap.docs.map(d => ({ id: d.id, items: [], ...d.data() }))

        // Fetch items subcollections for each pickup
        const withItems = await Promise.all(basePickups.map(async p => {
          try {
            const itemsSnap = await getDocs(collection(db, 'pickups', p.id, 'items'))
            const items = itemsSnap.docs.map(i => ({ id: i.id, ...i.data() }))
            return { ...p, items }
          } catch {
            return p
          }
        }))

        setPickups(withItems)
      } catch (err) {
        if (!cancelled) setErrorPickups(err?.message || 'Failed to load pickups')
      } finally {
        if (!cancelled) setLoadingPickups(false)
      }
    }

    loadRoutes()
    loadPickups()
    return () => { cancelled = true }
  }, [])

  const now = new Date()
  const { currentRoutes, upcomingRoutes, pastRoutes } = useMemo(() => {
    const enriched = routes.map(r => {
      const scheduled = toDateMaybe(r.scheduledAt || r.date || r.scheduledDate)
      const status = r.status || (scheduled ? (isSameDay(scheduled, now) ? 'active' : (scheduled > now ? 'scheduled' : 'completed')) : 'unknown')
      return { ...r, scheduledAtParsed: scheduled, computedStatus: status }
    })

    const current = enriched.filter(r => {
      const { routeStart, routeEnd } = deriveRouteTimes(r)
      const inWindow = !!routeStart && !!routeEnd && now >= routeStart && now <= routeEnd
      if (import.meta?.env?.MODE !== 'production') {
        try {
          console.debug('[CurrentRoutes] route', {
            id: r.id,
            name: r.name || r.title || 'Route',
            routeStart: formatDateTime(routeStart),
            routeEnd: formatDateTime(routeEnd),
            now: formatDateTime(now),
            inWindow
          })
        } catch {}
      }
      return inWindow
    })

    if (import.meta?.env?.MODE !== 'production') {
      try {
        console.debug(`[CurrentRoutes] selected ${current.length} of ${enriched.length}`)
      } catch {}
    }

    const upcoming = enriched
      .filter(r => r.scheduledAtParsed && r.scheduledAtParsed > now)
      .sort((a, b) => a.scheduledAtParsed - b.scheduledAtParsed)

    const past = enriched
      .filter(r => r.scheduledAtParsed && r.scheduledAtParsed < now && !isSameDay(r.scheduledAtParsed, now) || ['complete','completed','done'].includes((r.status || r.computedStatus || '').toString().toLowerCase()))
      .sort((a, b) => b.scheduledAtParsed - a.scheduledAtParsed)

    return { currentRoutes: current, upcomingRoutes: upcoming, pastRoutes: past }
  }, [routes])

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--accent-color)' }}>Operational overview of routes and pickups</p>
      </section>

      {/* Overview Panels: Current Routes, Upcoming Routes, Past Routes, Pickups */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', alignItems: 'start' }}>
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Current Routes</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            {loadingRoutes && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
            {errorRoutes && <p style={{ color: 'salmon' }}>{errorRoutes}</p>}
            {!loadingRoutes && !errorRoutes && (
              currentRoutes.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentRoutes.map(r => (
                    <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name || r.title || 'Route'}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{formatDateTime(r.scheduledAtParsed)}{r.driver ? ` • ${r.driver}` : ''}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Route: {formatTimeRange(deriveRouteTimes(r).routeStart, deriveRouteTimes(r).routeEnd)}</div>
                      </div>
                      <span style={{ backgroundColor: statusPillColor(r.status || r.computedStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {(r.status || r.computedStatus || 'unknown').toString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)' }}>No current routes.</p>
              )
            )}
          </div>
        </section>

        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Upcoming Routes</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            {loadingRoutes && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
            {errorRoutes && <p style={{ color: 'salmon' }}>{errorRoutes}</p>}
            {!loadingRoutes && !errorRoutes && (
              upcomingRoutes.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {upcomingRoutes.map(r => (
                    <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name || r.title || 'Route'}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{formatDateTime(r.scheduledAtParsed)}{r.driver ? ` • ${r.driver}` : ''}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Route: {formatTimeRange(deriveRouteTimes(r).routeStart, deriveRouteTimes(r).routeEnd)}</div>
                      </div>
                      <span style={{ backgroundColor: statusPillColor(r.status || r.computedStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {(r.status || r.computedStatus || 'scheduled').toString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)' }}>No upcoming routes.</p>
              )
            )}
          </div>
        </section>

        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Past Routes</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            {loadingRoutes && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
            {errorRoutes && <p style={{ color: 'salmon' }}>{errorRoutes}</p>}
            {!loadingRoutes && !errorRoutes && (
              pastRoutes.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pastRoutes.map(r => (
                    <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name || r.title || 'Route'}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{formatDateTime(r.scheduledAtParsed)}{r.driver ? ` • ${r.driver}` : ''}</div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Route: {formatTimeRange(deriveRouteTimes(r).routeStart, deriveRouteTimes(r).routeEnd)}</div>
                      </div>
                      <span style={{ backgroundColor: statusPillColor(r.status || r.computedStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {(r.status || r.computedStatus || 'completed').toString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)' }}>No past routes.</p>
              )
            )}
          </div>
        </section>

        {/* Pickups */}
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Pickups</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            {loadingPickups && <p style={{ color: 'var(--accent-color)' }}>Loading pickups…</p>}
            {errorPickups && <p style={{ color: 'salmon' }}>{errorPickups}</p>}
            {!loadingPickups && !errorPickups && (
              pickups.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pickups.map(p => {
                    const scheduled = toDateMaybe(p.scheduledAt || p.date)
                    const status = (p.status || (scheduled ? (scheduled > now ? 'scheduled' : 'active') : 'unknown')).toString()
                    return (
                      <li key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.reference || p.customerName || p.name || 'Pickup'}</div>
                            <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                              {p.address ? `${p.address} • ` : ''}{formatDateTime(scheduled)}
                            </div>
                            <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                              Window: {formatTimeRange(toDateMaybe(p.windowStart || p.pickupWindowStart || p.window_start || p.window?.start), toDateMaybe(p.windowEnd || p.pickupWindowEnd || p.window_end || p.window?.end))}{toDateMaybe(p.pickedUpAt || p.pickupTime || p.collectedAt) ? ` • Picked up: ${formatTime(toDateMaybe(p.pickedUpAt || p.pickupTime || p.collectedAt))}` : ''}
                            </div>
                          </div>
                          <span style={{ backgroundColor: statusPillColor(status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                            {status}
                          </span>
                        </div>
                        {p.items?.length ? (
                          <div style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Items ({p.items.length})</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {p.items.map(item => (
                                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                                  <div>
                                    <div style={{ fontWeight: 500 }}>{item.name || item.description || `Item ${item.id}`}</div>
                                    <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                                      {item.quantity ? `Qty ${item.quantity}` : ''}{item.size ? ` • ${item.size}` : ''}{item.notes ? ` • ${item.notes}` : ''}
                                    </div>
                                  </div>
                                  {item.status && (
                                    <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                      {item.status}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div style={{ padding: '0.75rem 1rem', color: 'var(--accent-color)', fontSize: '0.95rem' }}>No items.</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)' }}>No pickups found.</p>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default Dashboard