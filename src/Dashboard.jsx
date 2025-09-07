import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function toDateMaybe(value) {
  console.log('toDateMaybe called with:', value, 'type:', typeof value)
  if (!value) {
    console.log('toDateMaybe: value is falsy, returning null')
    return null
  }
  if (value?.toDate) {
    try { 
      const result = value.toDate()
      console.log('toDateMaybe: converted Firestore timestamp to:', result)
      return result
    } catch (err) { 
      console.log('toDateMaybe: failed to convert Firestore timestamp:', err)
      /* noop */ 
    }
  }
  if (typeof value === 'number') {
    const result = new Date(value)
    console.log('toDateMaybe: converted number to date:', result)
    return result
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    const isValid = !isNaN(d.getTime())
    console.log('toDateMaybe: converted string to date:', d, 'valid:', isValid)
    return isValid ? d : null
  }
  console.log('toDateMaybe: unhandled value type, returning null')
  return null
}

function isSameDay(a, b) {
  console.log('isSameDay called with:', a, b)
  const result = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  console.log('isSameDay result:', result)
  return result
}

function formatDateTime(date) {
  console.log('formatDateTime called with:', date)
  if (!date) {
    console.log('formatDateTime: date is falsy, returning —')
    return '—'
  }
  const result = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  console.log('formatDateTime result:', result)
  return result
}

function formatTime(date) {
  console.log('formatTime called with:', date)
  if (!date) {
    console.log('formatTime: date is falsy, returning —')
    return '—'
  }
  const result = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
  console.log('formatTime result:', result)
  return result
}

function formatTimeRange(start, end) {
  console.log('formatTimeRange called with start:', start, 'end:', end)
  if (start && end) {
    const result = `${formatTime(start)}–${formatTime(end)}`
    console.log('formatTimeRange: both dates present, result:', result)
    return result
  }
  if (start) {
    const result = `${formatTime(start)}–—`
    console.log('formatTimeRange: only start date, result:', result)
    return result
  }
  if (end) {
    const result = `—–${formatTime(end)}`
    console.log('formatTimeRange: only end date, result:', result)
    return result
  }
  console.log('formatTimeRange: no dates, returning —')
  return '—'
}

function deriveRouteTimes(route) {
  console.log('deriveRouteTimes called with route:', route)
  const startCandidates = []
  const endCandidates = []

  const routeStartRaw = route.scheduledTimeLocal || route.scheduledTime
  const routeEndRaw = route.endTimeLocal || route.endTime
  console.log('deriveRouteTimes: routeStartRaw:', routeStartRaw, 'routeEndRaw:', routeEndRaw)
  
  const routeStart = toDateMaybe(routeStartRaw)
  const routeEnd = toDateMaybe(routeEndRaw)
  console.log('deriveRouteTimes: parsed routeStart:', routeStart, 'routeEnd:', routeEnd)
  
  if (routeStart) startCandidates.push(routeStart)
  if (routeEnd) endCandidates.push(routeEnd)

  if (Array.isArray(route.pickups)) {
    console.log('deriveRouteTimes: processing', route.pickups.length, 'pickups')
    route.pickups.forEach((p, idx) => {
      console.log('deriveRouteTimes: processing pickup', idx, ':', p)
      const pStart = toDateMaybe(p?.scheduledTimeLocal || p?.scheduledTime)
      const pEnd = toDateMaybe(p?.endTimeLocal || p?.endTime)
      console.log('deriveRouteTimes: pickup', idx, 'pStart:', pStart, 'pEnd:', pEnd)
      if (pStart) startCandidates.push(pStart)
      if (pEnd) endCandidates.push(pEnd)
    })
  }

  console.log('deriveRouteTimes: startCandidates:', startCandidates, 'endCandidates:', endCandidates)
  
  const routeStartFinal = startCandidates.length ? new Date(Math.min(...startCandidates.map(d => d.getTime()))) : null
  const routeEndFinal = endCandidates.length ? new Date(Math.max(...endCandidates.map(d => d.getTime()))) : null
  
  console.log('deriveRouteTimes: final result - routeStart:', routeStartFinal, 'routeEnd:', routeEndFinal)
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
  
  // Lookup state
  const [lookupType, setLookupType] = useState('route')
  const [lookupAddress, setLookupAddress] = useState('')
  const [lookupDay, setLookupDay] = useState('')
  const [hideFuture, setHideFuture] = useState(false)
  const [hidePast, setHidePast] = useState(false)

  // Modal selection state
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedType, setSelectedType] = useState(null) // 'route' | 'pickup'

  const closeModal = () => {
    setSelectedItem(null)
    setSelectedType(null)
  }

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      setLoadingRoutes(true)
      setErrorRoutes('')
      try {
        const snap = await getDocs(collection(db, 'routes'))
        if (cancelled) return
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Enrich with driver profile from users/{driverId}
        const driverIds = Array.from(new Set(all.map(r => r.driverId).filter(Boolean)))
        let driverMap = {}
        if (driverIds.length) {
          const profiles = await Promise.all(driverIds.map(async (uid) => {
            try {
              const s = await getDoc(doc(db, 'users', uid))
              return s.exists() ? { id: uid, ...s.data() } : null
            } catch {
              return null
            }
          }))
          driverMap = Object.fromEntries(profiles.filter(Boolean).map(u => [u.id, u]))
        }

        const withDriver = all.map(r => {
          const u = r.driverId ? driverMap[r.driverId] : null
          const fullName = u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : ''
          return {
            ...r,
            driver: fullName || r.driver || undefined,
            driverProfile: u || undefined,
          }
        })

        setRoutes(withDriver)
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

  // Filtered results for lookup box
  const filteredResults = useMemo(() => {
    const term = (lookupAddress || '').trim().toLowerCase()
    const hasTerm = term.length > 0
    const dayDate = lookupDay ? new Date(`${lookupDay}T00:00:00`) : null

    const textMatches = (value) => {
      if (!hasTerm) return true
      if (!value) return false
      return value.toString().toLowerCase().includes(term)
    }

    const isSameDaySafe = (a, b) => {
      if (!a || !b) return false
      return isSameDay(a, b)
    }

    const classifyRouteTime = (r) => {
      const times = deriveRouteTimes(r)
      if (times.routeStart && times.routeEnd) {
        if (times.routeEnd < now) return 'past'
        if (times.routeStart > now) return 'future'
        return 'current'
      }
      const scheduled = toDateMaybe(r.scheduledAt || r.date || r.scheduledDate)
      if (scheduled) {
        if (isSameDay(scheduled, now)) return 'current'
        return scheduled > now ? 'future' : 'past'
      }
      return 'unknown'
    }

    const classifyPickupTime = (p) => {
      const start = toDateMaybe(p.windowStart || p.pickupWindowStart || p.window_start || p.window?.start || p.scheduledWindowStart)
      const end = toDateMaybe(p.windowEnd || p.pickupWindowEnd || p.window_end || p.window?.end || p.scheduledWindowEnd)
      if (start && end) {
        if (end < now) return 'past'
        if (start > now) return 'future'
        return 'current'
      }
      const scheduled = toDateMaybe(p.scheduledAt || p.date || p.scheduledTime || p.scheduledTimeLocal)
      if (scheduled) {
        if (isSameDay(scheduled, now)) return 'current'
        return scheduled > now ? 'future' : 'past'
      }
      return 'unknown'
    }

    if (lookupType === 'pickup') {
      const results = pickups.filter(p => {
        const scheduled = toDateMaybe(p.scheduledAt || p.date)
        const dayOk = dayDate ? isSameDaySafe(scheduled, dayDate) : true
        const textOk = hasTerm
          ? (
              textMatches(p.address) ||
              textMatches(p.reference) ||
              textMatches(p.customerName) ||
              textMatches(p.name)
            )
          : true
        if (!(dayOk && textOk)) return false
        const cls = classifyPickupTime(p)
        if (hideFuture && cls === 'future') return false
        if (hidePast && cls === 'past') return false
        return true
      })
      return { type: 'pickup', items: results }
    }

    // lookupType === 'route'
    const results = routes.filter(r => {
      const scheduled = toDateMaybe(r.scheduledAt || r.date || r.scheduledDate)
      const dayOk = dayDate ? isSameDaySafe(scheduled, dayDate) : true
      const textOk = hasTerm
        ? (
            textMatches(r.address) ||
            textMatches(r.name) ||
            textMatches(r.title) ||
            textMatches(r.driver) ||
            (Array.isArray(r.pickups) && r.pickups.some(p => textMatches(p?.address) || textMatches(p?.reference) || textMatches(p?.customerName)))
          )
        : true
      if (!(dayOk && textOk)) return false
      const cls = classifyRouteTime(r)
      if (hideFuture && cls === 'future') return false
      if (hidePast && cls === 'past') return false
      return true
    })
    return { type: 'route', items: results }
  }, [lookupType, lookupAddress, lookupDay, hideFuture, hidePast, routes, pickups])

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--accent-color)' }}>Operational overview of routes and pickups</p>
      </section>

      {/* Current Routes and Lookup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Current Routes</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            {loadingRoutes && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
            {errorRoutes && <p style={{ color: 'salmon' }}>{errorRoutes}</p>}
            {!loadingRoutes && !errorRoutes && (
              currentRoutes.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentRoutes.map(r => (
                    <li key={r.id} onClick={() => { setSelectedItem(r); setSelectedType('route') }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
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

        {/* Lookup */}
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Lookup</h2>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="lookup-type" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Type</label>
                <select id="lookup-type" value={lookupType} onChange={(e) => setLookupType(e.target.value)} style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <option value="route">Route</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '240px', flex: '1 1 260px' }}>
                <label htmlFor="lookup-address" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Address or keyword</label>
                <input id="lookup-address" type="text" value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)} placeholder={lookupType === 'pickup' ? '123 Main St, Austin…' : 'Route name, driver, address…'} style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="lookup-day" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Day</label>
                <input id="lookup-day" type="date" value={lookupDay} onChange={(e) => setLookupDay(e.target.value)} style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={hideFuture} onChange={(e) => setHideFuture(e.target.checked)} /> Hide future
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={hidePast} onChange={(e) => setHidePast(e.target.checked)} /> Hide past
                </label>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Results</div>
              {filteredResults.type === 'route' ? (
                loadingRoutes ? (
                  <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>
                ) : errorRoutes ? (
                  <p style={{ color: 'salmon' }}>{errorRoutes}</p>
                ) : filteredResults.items.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredResults.items.map(r => (
                      <li key={r.id} onClick={() => { setSelectedItem(r); setSelectedType('route') }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{r.name || r.title || 'Route'}</div>
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{formatDateTime(toDateMaybe(r.scheduledAt || r.date || r.scheduledDate))}{r.driver ? ` • ${r.driver}` : ''}</div>
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Route: {formatTimeRange(deriveRouteTimes(r).routeStart, deriveRouteTimes(r).routeEnd)}</div>
                        </div>
                        <span style={{ backgroundColor: statusPillColor(r.status || r.computedStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {(r.status || r.computedStatus || 'unknown').toString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--accent-color)' }}>No matching routes.</p>
                )
              ) : (
                loadingPickups ? (
                  <p style={{ color: 'var(--accent-color)' }}>Loading pickups…</p>
                ) : errorPickups ? (
                  <p style={{ color: 'salmon' }}>{errorPickups}</p>
                ) : filteredResults.items.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredResults.items.map(p => {
                      const scheduled = toDateMaybe(p.scheduledAt || p.date)
                      const status = (p.status || (scheduled ? (scheduled > now ? 'scheduled' : 'active') : 'unknown')).toString()
                      return (
                        <li key={p.id} onClick={() => { setSelectedItem(p); setSelectedType('pickup') }} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}>
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
                  <p style={{ color: 'var(--accent-color)' }}>No matching pickups.</p>
                )
              )}
            </div>
          </div>
        </section>
      </div>
      {/* Modal: item details */}
      {selectedItem && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(900px, 92vw)', maxHeight: '80vh', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700 }}>
                {selectedType === 'route' ? 'Route Details' : 'Pickup Details'}
              </div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--secondary-color)' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '1rem', overflow: 'auto', color: 'var(--accent-color)' }}>
              {selectedType === 'route' && (() => {
                const routeStatus = (selectedItem.status || selectedItem.computedStatus || 'unknown').toString()
                const scheduled = toDateMaybe(selectedItem.scheduledAt || selectedItem.date || selectedItem.scheduledDate)
                const times = deriveRouteTimes(selectedItem)
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--secondary-color)' }}>{selectedItem.name || selectedItem.title || 'Route'}</div>
                      <span style={{ backgroundColor: statusPillColor(routeStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{routeStatus}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', columnGap: '1rem', rowGap: '0.4rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Driver</div>
                      <div>{selectedItem.driver || '—'}</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Scheduled</div>
                      <div>{formatDateTime(scheduled)}</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Window</div>
                      <div>{formatTimeRange(times.routeStart, times.routeEnd)}</div>
                      {selectedItem.notes && (<>
                        <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Notes</div>
                        <div>{selectedItem.notes}</div>
                      </>)}
                    </div>
                    {Array.isArray(selectedItem.pickups) && selectedItem.pickups.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Stops ({selectedItem.pickups.length})</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedItem.pickups.map((p, idx) => {
                            const pScheduled = toDateMaybe(p?.scheduledAt || p?.date || p?.scheduledTime || p?.scheduledTimeLocal)
                            const pStart = toDateMaybe(p?.scheduledWindowStart || p?.windowStart || p?.window_start || p?.window?.start)
                            const pEnd = toDateMaybe(p?.scheduledWindowEnd || p?.windowEnd || p?.window_end || p?.window?.end)
                            const pStatus = (p?.status || 'unknown').toString()
                            return (
                              <li key={p?.id || idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{p?.reference || p?.customerName || p?.name || 'Stop'}</div>
                                    <div style={{ fontSize: '0.9rem' }}>{p?.address || '—'}{pScheduled ? ` • ${formatDateTime(pScheduled)}` : ''}</div>
                                    <div style={{ fontSize: '0.85rem' }}>Window: {formatTimeRange(pStart, pEnd)}</div>
                                  </div>
                                  <span style={{ backgroundColor: statusPillColor(pStatus), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{pStatus}</span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })()}

              {selectedType === 'pickup' && (() => {
                const scheduled = toDateMaybe(selectedItem.scheduledAt || selectedItem.date)
                const start = toDateMaybe(selectedItem.windowStart || selectedItem.pickupWindowStart || selectedItem.window_start || selectedItem.window?.start)
                const end = toDateMaybe(selectedItem.windowEnd || selectedItem.pickupWindowEnd || selectedItem.window_end || selectedItem.window?.end)
                const pickupStatus = (selectedItem.status || 'unknown').toString()
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--secondary-color)' }}>{selectedItem.reference || selectedItem.customerName || selectedItem.name || 'Pickup'}</div>
                      <span style={{ backgroundColor: statusPillColor(pickupStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{pickupStatus}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', columnGap: '1rem', rowGap: '0.4rem' }}>
                      {selectedItem.customerName && (<>
                        <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Customer</div>
                        <div>{selectedItem.customerName}</div>
                      </>)}
                      {selectedItem.reference && (<>
                        <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Reference</div>
                        <div>{selectedItem.reference}</div>
                      </>)}
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Address</div>
                      <div>{selectedItem.address || '—'}</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Scheduled</div>
                      <div>{formatDateTime(scheduled)}</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Window</div>
                      <div>{formatTimeRange(start, end)}</div>
                      {selectedItem.notes && (<>
                        <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Notes</div>
                        <div>{selectedItem.notes}</div>
                      </>)}
                    </div>
                    {Array.isArray(selectedItem.items) && selectedItem.items.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Items ({selectedItem.items.length})</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedItem.items.map((item, idx) => (
                            <li key={item?.id || idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{item?.name || item?.description || `Item ${idx + 1}`}</div>
                                <div style={{ fontSize: '0.85rem' }}>
                                  {item?.quantity ? `Qty ${item.quantity}` : ''}{item?.size ? ` • ${item.size}` : ''}{item?.notes ? ` • ${item.notes}` : ''}
                                </div>
                              </div>
                              {item?.status && (
                                <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{item.status}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Dashboard