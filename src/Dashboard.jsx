import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function toDateMaybe(value) {
  if (!value) {
    return null
  }
  if (value?.toDate) {
    try { 
      const result = value.toDate()
      return result
    } catch (err) { 
      console.log('toDateMaybe: failed to convert Firestore timestamp:', err)
      /* noop */ 
    }
  }
  if (typeof value === 'number') {
    const result = new Date(value)
    return result
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    const isValid = !isNaN(d.getTime())
    return isValid ? d : null
  }
  return null
}

function formatPickupAddressObject(address) {
  if (!address || typeof address !== 'object') return ''
  const line1 = address.street || ''
  const cityState = [address.city, address.state].filter(Boolean).join(', ')
  const parts = [line1, cityState, address.zip].filter(Boolean)
  return parts.join(' • ')
}

function formatPickupAddress(p) {
  if (!p) return ''
  if (typeof p.address === 'string' && p.address.trim().length) return p.address
  if (p.pickupAddress) return formatPickupAddressObject(p.pickupAddress)
  return ''
}

function isSameDay(a, b) {
  const result = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  return result
}

function formatDateTime(date) {
  if (!date) {
    return '—'
  }
  const result = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  return result
}

function formatTime(date) {
  if (!date) {
    return '—'
  }
  const result = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
  return result
}

function formatTimeRange(start, end) {
  if (start && end) {
    const result = `${formatTime(start)}–${formatTime(end)}`
    return result
  }
  if (start) {
    const result = `${formatTime(start)}–—`
    return result
  }
  if (end) {
    const result = `—–${formatTime(end)}`
    return result
  }
  return '—'
}

function deriveRouteTimes(route) {
  const startCandidates = []
  const endCandidates = []

  const routeStartRaw = route.scheduledWindowStart || route.scheduledTimeLocal || route.scheduledTime
  const routeEndRaw = route.scheduledWindowEnd || route.endTimeLocal || route.endTime
  
  const routeStart = toDateMaybe(routeStartRaw)
  const routeEnd = toDateMaybe(routeEndRaw)
  
  if (routeStart) startCandidates.push(routeStart)
  if (routeEnd) endCandidates.push(routeEnd)

  if (Array.isArray(route.pickups)) {
    route.pickups.forEach((p, idx) => {
      const pStart = toDateMaybe(p?.scheduledWindowStart || p?.scheduledTimeLocal || p?.scheduledTime)
      const pEnd = toDateMaybe(p?.scheduledWindowEnd || p?.endTimeLocal || p?.endTime)
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
  if (['active', 'in_progress', 'in-progress', 'ongoing', 'received'].includes(s)) return '#0284c7'
  if (['scheduled', 'pending', 'upcoming'].includes(s)) return '#a16207'
  if (['cancelled', 'canceled', 'failed'].includes(s)) return '#dc2626'
  return '#475569'
}

async function getPickupById(pickupId) {
  try {
    const pickupRef = doc(db, 'pickups', pickupId)
    const pickupSnap = await getDoc(pickupRef)
    
    if (pickupSnap.exists()) {
      const pickupData = { id: pickupSnap.id, ...pickupSnap.data() }
      
      // Also fetch the items subcollection
      try {
        const itemsSnap = await getDocs(collection(db, 'pickups', pickupId, 'items'))
        const items = itemsSnap.docs.map(i => ({ id: i.id, ...i.data() }))
        pickupData.items = items
      } catch (err) {
        console.log('Failed to load items:', err)
        pickupData.items = []
      }
      
      return pickupData
    } else {
      console.log('No pickup found with ID:', pickupId)
      return null
    }
  } catch (error) {
    console.error('Error fetching pickup:', error)
    throw error
  }
}

function RouteTile({ route, onClick }) {
  const scheduled = toDateMaybe(route.scheduledAt || route.date || route.scheduledDate)
  const times = deriveRouteTimes(route)
  const status = (route.status || route.computedStatus || 'unknown').toString()
  
  return (
    <li onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{route.name || route.title || 'Route'}</div>
        <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
          {scheduled ? scheduled.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''}
          {route.driver ? ` • ${route.driver}` : ''}
        </div>
        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Route: {formatTimeRange(times.routeStart, times.routeEnd)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
        <div style={{ 
          color: 'var(--accent-color)', 
          fontSize: '0.75rem',
          backgroundColor: 'rgba(0, 47, 71, 0.05)',
          padding: '0.3rem 0.5rem',
          borderRadius: '4px',
          border: '1px solid rgba(0, 47, 71, 0.1)',
          fontFamily: 'monospace',
          fontWeight: 600
        }}>
          Route ID: {route.id ? route.id.slice(-4) : '—'}
        </div>
        <span style={{ backgroundColor: statusPillColor(status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
          {status}
        </span>
      </div>
    </li>
  )
}

function PickupTile({ pickup, onClick, itemsMap }) {
  const scheduled = toDateMaybe(pickup.scheduledTime || pickup.scheduledTimeLocal || pickup.scheduledAt || pickup.date || pickup.scheduledDate)
  const addrStr = formatPickupAddress(pickup)
  const status = (pickup.status || (scheduled ? (scheduled > new Date() ? 'scheduled' : 'active') : 'unknown')).toString()
  
  return (
    <li onClick={onClick} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', backgroundColor: 'rgba(0,0,0,0.02)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{pickup.reference || pickup.customerName || pickup.name || 'Pickup'}</div>
          <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
            {addrStr ? `${addrStr} • ` : ''}{formatDateTime(scheduled)}
          </div>
          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
            Window: {formatTimeRange(toDateMaybe(pickup.scheduledWindowStart || pickup.windowStart || pickup.pickupWindowStart || pickup.window_start || pickup.window?.start), toDateMaybe(pickup.scheduledWindowEnd || pickup.windowEnd || pickup.pickupWindowEnd || pickup.window_end || pickup.window?.end))}{toDateMaybe(pickup.pickedUpAt || pickup.pickupTime || pickup.collectedAt) ? ` • Picked up: ${formatTime(toDateMaybe(pickup.pickedUpAt || pickup.pickupTime || pickup.collectedAt))}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ 
            color: 'var(--accent-color)', 
            fontSize: '0.75rem',
            backgroundColor: 'rgba(0, 47, 71, 0.05)',
            padding: '0.3rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(0, 47, 71, 0.1)',
            fontFamily: 'monospace',
            fontWeight: 600
          }}>
            Pickup ID: {pickup.id ? pickup.id.slice(-4) : '—'}
          </div>
          <span style={{ backgroundColor: statusPillColor(status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
            {status}
          </span>
        </div>
      </div>
      {pickup.items?.length ? (
        <div style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Items ({pickup.items.length})</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pickup.items.map((itemRef, idx) => {
              // Handle both string IDs and objects with itemId property
              const itemId = typeof itemRef === 'string' ? itemRef : itemRef.itemId || itemRef.id
              const item = itemsMap[itemId]
              
              if (!item) {
                return (
                  <li key={itemId || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px dashed #dc2626', borderRadius: '8px', backgroundColor: '#fef2f2' }}>
                    <div style={{ color: '#dc2626', fontWeight: 500 }}>
                      Item not found: {itemId}
                    </div>
                  </li>
                )
              }

              return (
                <li key={item.id || itemId || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Item Image */}
                    {(item.photo?.url || item.driverPhoto?.url) && (
                      <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                        <img 
                          src={item.photo?.url || item.driverPhoto?.url} 
                          alt={item.name || 'Item'} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            backgroundColor: '#f5f5f5'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      {item.description && (
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          <strong>Description:</strong> {item.description}
                        </div>
                      )}
                      <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {item.size ? `Item Size: ${item.size} cubic ft` : ''}{item.notes ? ` • ${item.notes}` : ''}
                      </div>
                    </div>
                    <div style={{ 
                      color: 'var(--accent-color)', 
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(0, 47, 71, 0.05)',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(0, 47, 71, 0.1)',
                      fontFamily: 'monospace',
                      fontWeight: 600
                    }}>
                      Item ID: {item.id ? item.id.slice(-4) : '—'}
                    </div>
                  </div>
                  {item.status && (
                    <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {item.status}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', color: 'var(--accent-color)', fontSize: '0.95rem' }}>No items.</div>
      )}
    </li>
  )
}

function ItemTile({ item, onClick }) {
  return (
    <li onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
        {/* Item Image */}
        {(item.photo?.url || item.driverPhoto?.url) && (
          <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
            <img 
              src={item.photo?.url || item.driverPhoto?.url} 
              alt={item.name || item.description || 'Item'} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                backgroundColor: '#f5f5f5'
              }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          </div>
        )}
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{item.name}</div>
          {item.description && (
            <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              <strong>Description:</strong> {item.description}
            </div>
          )}
          <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
            Pickup: {item.pickupReference} • {formatDateTime(item.pickupScheduled)}
          </div>
          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
            {item.pickupAddress}
          </div>
          <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>
            {item.size ? `Item Size: ${item.size} cubic ft` : ''}{item.notes ? ` • ${item.notes}` : ''}
          </div>
        </div>
        
      </div>
      
      {item.status && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ 
            color: 'var(--accent-color)', 
            fontSize: '0.75rem',
            backgroundColor: 'rgba(0, 47, 71, 0.05)',
            padding: '0.3rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(0, 47, 71, 0.1)',
            fontFamily: 'monospace',
            fontWeight: 600
          }}>
            Item ID: {item.id ? item.id.slice(-4) : '—'}
          </div>
          <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
            {item.status}
          </span>
        </div>
      )}
    </li>
  )
}

function Dashboard() {
  const [routes, setRoutes] = useState([])
  const [pickups, setPickups] = useState([])
  const [items, setItems] = useState([]) // Add items state
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [loadingPickups, setLoadingPickups] = useState(true)
  const [loadingItems, setLoadingItems] = useState(true) // Add loading state for items
  const [errorRoutes, setErrorRoutes] = useState('')
  const [errorPickups, setErrorPickups] = useState('')
  const [errorItems, setErrorItems] = useState('') // Add error state for items
  
  // Lookup state
  const [lookupType, setLookupType] = useState('route')
  const [lookupAddress, setLookupAddress] = useState('')
  const [lookupDay, setLookupDay] = useState('')
  const [hideFuture, setHideFuture] = useState(false)
  const [hidePast, setHidePast] = useState(false)
  const [lookupSort, setLookupSort] = useState('asc') // asc | desc

  // Modal selection state
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedType, setSelectedType] = useState(null) // 'route' | 'pickup' | 'item'
  const [modalView, setModalView] = useState('main') // 'main' | 'pickups' | 'items'
  const [parentItem, setParentItem] = useState(null) // For navigation context
  const [routeContext, setRouteContext] = useState(null) // Store the original route when navigating to items

  // Create pickup lookup map for efficient access
  const pickupMap = useMemo(() => {
    return Object.fromEntries(pickups.map(p => [p.id, p]))
  }, [pickups])

  // Create items lookup map for efficient access
  const itemsMap = useMemo(() => {
    return Object.fromEntries(items.map(item => [item.id, item]))
  }, [items])

  const closeModal = () => {
    setSelectedItem(null)
    setSelectedType(null)
    setModalView('main')
    setParentItem(null)
    setRouteContext(null)
  }

  const navigateToPickups = (route) => {
    setParentItem(route)
    setRouteContext(route) // Store the route context
    setModalView('pickups')
  }

  const navigateToItems = (pickup) => {
    setParentItem(pickup)
    setModalView('items')
    // Keep the routeContext as is - it should already be set from navigateToPickups
  }

  const navigateBack = () => {
    if (modalView === 'items') {
      // Go back from items to pickups view
      setModalView('pickups')
      setSelectedItem(routeContext) // Go back to the route
      setParentItem(routeContext) // Set parent back to route
      setSelectedType('route')
    } else if (modalView === 'pickups') {
      // Go back from pickups to main view
      setModalView('main')
      setSelectedItem(null)
      setParentItem(null)
      setRouteContext(null)
      setSelectedType(null)
    }
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
      console.log('loadPickups: Starting to load pickups')
      setLoadingPickups(true)
      setErrorPickups('')
      try {
        console.log('loadPickups: Fetching pickups collection')
        const snap = await getDocs(collection(db, 'pickups'))
        if (cancelled) {
          console.log('loadPickups: Operation cancelled, returning early')
          return
        }
        const basePickups = snap.docs.map(d => ({ id: d.id, items: [], ...d.data() }))
        // console.log('loadPickups: Found', basePickups.length, 'base pickups')

        // Fetch items subcollections for each pickup
        // console.log('loadPickups: Fetching items for each pickup')
        const withItems = await Promise.all(basePickups.map(async p => {
          try {
            // console.log('loadPickups: Fetching items for pickup', p.id)
            const pickup = await getDocs(collection(db, 'pickups', p.id))
            // console.log('loadPickups: Found', pickup.docs.length, 'items for pickup', p.id)

            // const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            // console.log('loadPickups: Found', items.length, 'items for pickup', p.id)
            return { ...p, items }
          } catch (error) {
            console.log('loadPickups: Error fetching items for pickup', p.id, ':', error)
            return p
          }
        }))

        // console.log('loadPickups: Successfully loaded', withItems.length, 'pickups with items')
        setPickups(withItems)
      } catch (err) {
        console.error('loadPickups: Error loading pickups:', err)
        if (!cancelled) setErrorPickups(err?.message || 'Failed to load pickups')
      } finally {
        if (!cancelled) {
          // console.log('loadPickups: Finished loading pickups')
          setLoadingPickups(false)
        }
      }
    }

    async function loadItems() {
      console.log('loadItems: Starting to load items')
      setLoadingItems(true)
      setErrorItems('')
      try {
        console.log('loadItems: Fetching items collection')
        const snap = await getDocs(collection(db, 'items'))
        if (cancelled) {
          console.log('loadItems: Operation cancelled, returning early')
          return
        }
        const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        console.log('loadItems: Successfully loaded', allItems.length, 'items')
        setItems(allItems)
      } catch (err) {
        console.error('loadItems: Error loading items:', err)
        if (!cancelled) setErrorItems(err?.message || 'Failed to load items')
      } finally {
        if (!cancelled) {
          console.log('loadItems: Finished loading items')
          setLoadingItems(false)
        }
      }
    }

    loadRoutes()
    loadPickups()
    loadItems() // Add items loading
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
      return inWindow
    })

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
      const withKey = results.map(p => ({
        _key: toDateMaybe(p.scheduledTime || p.scheduledTimeLocal || p.scheduledAt || p.date || p.scheduledDate)?.getTime() || 0,
        v: p,
      }))
      withKey.sort((a, b) => lookupSort === 'asc' ? a._key - b._key : b._key - a._key)
      return { type: 'pickup', items: withKey.map(x => x.v) }
    }

    if (lookupType === 'item') {
      // Flatten all items from all pickups
      const allItems = []
      pickups.forEach(pickup => {
        if (Array.isArray(pickup.items)) {
          pickup.items.forEach(item => {
            allItems.push({
              ...item,
              pickupId: pickup.id,
              pickupReference: pickup.reference || pickup.customerName || pickup.name,
              pickupAddress: formatPickupAddress(pickup),
              pickupScheduled: toDateMaybe(pickup.scheduledAt || pickup.date)
            })
          })
        }
      })

      const results = allItems.filter(item => {
        const dayOk = dayDate ? isSameDaySafe(item.pickupScheduled, dayDate) : true
        const textOk = hasTerm
          ? (
              textMatches(item.name) ||
              textMatches(item.description) ||
              textMatches(item.pickupReference) ||
              textMatches(item.pickupAddress) ||
              textMatches(item.notes)
            )
          : true
        if (!(dayOk && textOk)) return false
        const cls = classifyPickupTime({ scheduledAt: item.pickupScheduled })
        if (hideFuture && cls === 'future') return false
        if (hidePast && cls === 'past') return false
        return true
      })
      const withKey = results.map(item => ({
        _key: item.pickupScheduled?.getTime() || 0,
        v: item,
      }))
      withKey.sort((a, b) => lookupSort === 'asc' ? a._key - b._key : b._key - a._key)
      return { type: 'item', items: withKey.map(x => x.v) }
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
            (Array.isArray(r.pickups) && r.pickups.some(p => textMatches(formatPickupAddress(p)) || textMatches(p?.reference) || textMatches(p?.customerName)))
          )
        : true
      if (!(dayOk && textOk)) return false
      const cls = classifyRouteTime(r)
      if (hideFuture && cls === 'future') return false
      if (hidePast && cls === 'past') return false
      return true
    })
    const withKey = results.map(r => ({
      _key: (function() {
        const times = deriveRouteTimes(r)
        // Prefer route window start; fallback to scheduled date
        const dt = times.routeStart || toDateMaybe(r.scheduledAt || r.date || r.scheduledDate)
        return dt ? dt.getTime() : 0
      })(),
      v: r,
    }))
    withKey.sort((a, b) => lookupSort === 'asc' ? a._key - b._key : b._key - a._key)
    return { type: 'route', items: withKey.map(x => x.v) }
  }, [lookupType, lookupAddress, lookupDay, lookupSort, hideFuture, hidePast, routes, pickups])

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
                    <RouteTile 
                      key={r.id} 
                      route={r} 
                      onClick={() => { 
                        console.log('Route selected:', 'Route', 'Stops:', r.pickups || []);
                        setSelectedItem(r); 
                        setSelectedType('route');
                        navigateToPickups(r);
                      }} 
                    />
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
            <div className="dashboard-lookup-form" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px', flex: '1 1 120px' }}>
                <label htmlFor="lookup-type" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Type</label>
                <select id="lookup-type" value={lookupType} onChange={(e) => setLookupType(e.target.value)} style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', minHeight: '44px' }}>
                  <option value="route">Route</option>
                  <option value="pickup">Pickup</option>
                  <option value="item">Item</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '200px', flex: '1 1 300px' }}>
                <label htmlFor="lookup-address" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Address or keyword</label>
                <input id="lookup-address" type="text" value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)} placeholder={lookupType === 'pickup' ? '123 Main St, Austin…' : lookupType === 'item' ? 'Item name, description, notes…' : 'Route name, driver, address…'} style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', minHeight: '44px' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '140px', flex: '1 1 140px' }}>
                <label htmlFor="lookup-day" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Day</label>
                <input id="lookup-day" type="date" value={lookupDay} onChange={(e) => setLookupDay(e.target.value)} style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', minHeight: '44px' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '180px', flex: '1 1 180px' }}>
                <label htmlFor="lookup-sort" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>Sort</label>
                <select id="lookup-sort" value={lookupSort} onChange={(e) => setLookupSort(e.target.value)} style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', minHeight: '44px' }}>
                  <option value="asc">Date/time (oldest first)</option>
                  <option value="desc">Date/time (newest first)</option>
                </select>
              </div>
            </div>

            {/* Mobile-friendly filter checkboxes */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontSize: '0.9rem', minHeight: '44px' }}>
                <input type="checkbox" checked={hideFuture} onChange={(e) => setHideFuture(e.target.checked)} style={{ transform: 'scale(1.2)' }} /> Hide future
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontSize: '0.9rem', minHeight: '44px' }}>
                <input type="checkbox" checked={hidePast} onChange={(e) => setHidePast(e.target.checked)} style={{ transform: 'scale(1.2)' }} /> Hide past
              </label>
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
                      <RouteTile 
                        key={r.id} 
                        route={r} 
                        onClick={() => { 
                          console.log('Route selected:', r.name || r.title || 'Route', 'Stops:', r.pickups || []);
                          setSelectedItem(r); 
                          setSelectedType('route');
                          navigateToPickups(r);
                        }} 
                      />
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--accent-color)' }}>No matching routes.</p>
                )
              ) : lookupType === 'item' ? (
                loadingPickups ? (
                  <p style={{ color: 'var(--accent-color)' }}>Loading items…</p>
                ) : errorPickups ? (
                  <p style={{ color: 'salmon' }}>{errorPickups}</p>
                ) : filteredResults.items.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredResults.items.map(item => (
                      <ItemTile 
                        key={item.id} 
                        item={item} 
                        onClick={() => { 
                          setSelectedItem(item); 
                          setSelectedType('item');
                        }} 
                      />
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--accent-color)' }}>No matching items.</p>
                )
              ) : (
                loadingPickups ? (
                  <p style={{ color: 'var(--accent-color)' }}>Loading pickups…</p>
                ) : errorPickups ? (
                  <p style={{ color: 'salmon' }}>{errorPickups}</p>
                ) : filteredResults.items.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredResults.items.map(p => (
                      <PickupTile 
                        key={p.id} 
                        pickup={p} 
                        itemsMap={itemsMap}
                        onClick={() => { 
                          setSelectedItem(p); 
                          setSelectedType('pickup');
                          navigateToItems(p);
                        }} 
                      />
                    ))}
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
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(900px, 100%)', maxHeight: '90vh', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {modalView !== 'main' && (
                  <button onClick={navigateBack} style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', color: 'var(--secondary-color)' }} aria-label="Back">← Back</button>
                )}
                <div style={{ fontWeight: 700 }}>
                  {modalView === 'pickups' ? 'Route Pickups' : 
                   modalView === 'items' ? 'Pickup Items' : 
                   selectedType === 'route' ? 'Route Details' : 
                   selectedType === 'pickup' ? 'Pickup Details' : 
                   'Item Details'}
                </div>
              </div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--secondary-color)' }} aria-label="Close">×</button>
            </div>
            <div className="dashboard-modal-content" style={{ padding: '1rem', overflow: 'auto', color: 'var(--accent-color)' }}>
              {modalView === 'pickups' && (() => {
                const route = selectedItem
                const routeStatus = (route.status || route.computedStatus || 'unknown').toString()
                const scheduled = toDateMaybe(route.scheduledAt || route.date || route.scheduledDate)
                const times = deriveRouteTimes(route)
                
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', fontSize: '1.1rem' }}>{route.name || route.title || 'Route'}</div>
                        <div style={{ fontSize: '0.9rem' }}>{formatDateTime(scheduled)}{route.driver ? ` • ${route.driver}` : ''}</div>
                        <div style={{ fontSize: '0.85rem' }}>Window: {formatTimeRange(times.routeStart, times.routeEnd)}</div>
                      </div>
                      <span style={{ backgroundColor: statusPillColor(routeStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{routeStatus}</span>
                    </div>
                    
                    {Array.isArray(route.pickups) && route.pickups.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Pickups ({route.pickups.length})</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {route.pickups.map((pickupRef, idx) => {
                            // Handle both string IDs and objects with pickupId property
                            const pickupId = typeof pickupRef === 'string' ? pickupRef : pickupRef.pickupId
                            const pickup = pickupMap[pickupId]
                            
                            if (!pickup) {
                              return (
                                <li key={pickupId || idx} style={{ border: '1px solid #dc2626', borderRadius: '8px', padding: '0.75rem 1rem', backgroundColor: '#fef2f2' }}>
                                  <div style={{ color: '#dc2626', fontWeight: 600 }}>
                                    Pickup not found: {pickupId}
                                  </div>
                                </li>
                              )
                            }

                            const pScheduled = toDateMaybe(pickup.scheduledTime || pickup.scheduledTimeLocal || pickup.scheduledAt || pickup.date || pickup.scheduledDate)
                            const pStart = toDateMaybe(pickup.scheduledWindowStart || pickup.windowStart || pickup.pickupWindowStart || pickup.window_start || pickup.window?.start)
                            const pEnd = toDateMaybe(pickup.scheduledWindowEnd || pickup.windowEnd || pickup.pickupWindowEnd || pickup.window_end || pickup.window?.end)
                            const addrStr = formatPickupAddress(pickup)
                            const pStatus = (pickup.status || 'unknown').toString()
                            
                            return (
                              <li key={pickup.id || pickupId || idx} onClick={() => { 
                                setSelectedItem(pickup); 
                                setSelectedType('pickup');
                                navigateToItems(pickup);
                              }} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{pickup.reference || pickup.customerName || pickup.name || 'Pickup'}</div>
                                  <div style={{ fontSize: '0.9rem' }}>{addrStr || '—'}{pScheduled ? ` • ${formatDateTime(pScheduled)}` : ''}</div>
                                  <div style={{ fontSize: '0.85rem' }}>Window: {formatTimeRange(pStart, pEnd)}</div>
                                  {Array.isArray(pickup.items) && pickup.items.length > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginTop: '0.25rem' }}>
                                      {pickup.items.length} item{pickup.items.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                                <span style={{ backgroundColor: statusPillColor(pStatus), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{pStatus}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-color)' }}>
                        <p>No pickups found for this route.</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {modalView === 'items' && (() => {
                const pickup = selectedItem
                const scheduled = toDateMaybe(pickup.scheduledTime || pickup.scheduledTimeLocal || pickup.scheduledAt || pickup.date || pickup.scheduledDate)
                const start = toDateMaybe(pickup.scheduledWindowStart || pickup.windowStart || pickup.pickupWindowStart || pickup.window_start || pickup.window?.start)
                const end = toDateMaybe(pickup.scheduledWindowEnd || pickup.windowEnd || pickup.pickupWindowEnd || pickup.window_end || pickup.window?.end)
                const pickupStatus = (pickup.status || 'unknown').toString()
                const addrStr = formatPickupAddress(pickup)
                
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', fontSize: '1.1rem' }}>{pickup.reference || pickup.customerName || pickup.name || 'Pickup'}</div>
                        <div style={{ fontSize: '0.9rem' }}>{addrStr || '—'}{scheduled ? ` • ${formatDateTime(scheduled)}` : ''}</div>
                        <div style={{ fontSize: '0.85rem' }}>Window: {formatTimeRange(start, end)}</div>
                      </div>
                      <span style={{ backgroundColor: statusPillColor(pickupStatus), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{pickupStatus}</span>
                    </div>
                    
                    {Array.isArray(pickup.items) && pickup.items.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Items ({pickup.items.length})</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {pickup.items.map((itemRef, idx) => {
                            // Handle both string IDs and objects with itemId property
                            const itemId = typeof itemRef === 'string' ? itemRef : itemRef.itemId || itemRef.id
                            const item = itemsMap[itemId]
                            
                            if (!item) {
                              return (
                                <li key={itemId || idx} style={{ border: '1px solid #dc2626', borderRadius: '8px', padding: '0.75rem 1rem', backgroundColor: '#fef2f2' }}>
                                  <div style={{ color: '#dc2626', fontWeight: 600 }}>
                                    Item not found: {itemId}
                                  </div>
                                </li>
                              )
                            }

                            return (
                              <li key={item.id || itemId || idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  {/* Item Image */}
                                  {(item.photo?.url || item.driverPhoto?.url) && (
                                    <div style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                      <img 
                                        src={item.photo?.url || item.driverPhoto?.url} 
                                        alt={item.name || item.description || 'Item'} 
                                        style={{ 
                                          width: '100%', 
                                          height: '100%', 
                                          objectFit: 'cover',
                                          backgroundColor: '#f5f5f5'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                                    {item.description && (
                                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                        <strong>Description:</strong> {item.description}
                                      </div>
                                    )}
                                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                      {item.size ? `Item Size: ${item.size} cubic ft` : ''}{item.notes ? ` • ${item.notes}` : ''}
                                    </div>
                                  </div>
                                  <div style={{ 
                                    color: 'var(--accent-color)', 
                                    fontSize: '0.75rem',
                                    marginLeft: '1rem',
                                    backgroundColor: 'rgba(0, 47, 71, 0.05)',
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(0, 47, 71, 0.1)',
                                    fontFamily: 'monospace',
                                    fontWeight: 600
                                  }}>
                                    Item ID: {item.id ? item.id.slice(-4) : '—'}
                                  </div>
                                </div>
                                {item.status && (
                                  <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{item.status}</span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-color)' }}>
                        <p>No items found for this pickup.</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {modalView === 'main' && selectedType === 'item' && (() => {
                const item = selectedItem
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--secondary-color)', fontSize: '1.1rem' }}>{item.name}</div>
                      {item.description && (
                        <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          <strong>Description:</strong> {item.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.9rem' }}>Pickup: {item.pickupReference} • {formatDateTime(item.pickupScheduled)}</div>
                      <div style={{ fontSize: '0.85rem' }}>{item.pickupAddress}</div>
                    </div>
                    <div style={{ 
                      color: 'var(--accent-color)', 
                      fontSize: '0.75rem',
                      marginLeft: '1rem',
                      backgroundColor: 'rgba(0, 47, 71, 0.05)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(0, 47, 71, 0.1)',
                      fontFamily: 'monospace',
                      fontWeight: 600
                    }}>
                      Item ID: {item.id ? item.id.slice(-4) : '—'}
                    </div>
                      {item.status && (
                        <span style={{ backgroundColor: statusPillColor(item.status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{item.status}</span>
                      )}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', columnGap: '1rem', rowGap: '0.4rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Item Size</div>
                      <div>{item.size ? `${item.size} cubic ft` : '—'}</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>Notes</div>
                      <div>{item.notes || '—'}</div>
                    </div>
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