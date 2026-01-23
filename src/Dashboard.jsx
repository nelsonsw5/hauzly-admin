import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function toDateMaybe(value) {
  if (!value) return null
  if (value?.toDate) {
    try { 
      return value.toDate()
    } catch (err) { 
      console.log('toDateMaybe: failed to convert Firestore timestamp:', err)
    }
  }
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return !isNaN(d.getTime()) ? d : null
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

function statusPillColor(status) {
  const s = (status || '').toString().toLowerCase()
  if (['complete', 'completed', 'done'].includes(s)) return '#16a34a'
  if (['active', 'in_progress', 'in-progress', 'ongoing', 'received'].includes(s)) return '#0284c7'
  if (['scheduled', 'pending', 'upcoming'].includes(s)) return '#a16207'
  if (['cancelled', 'canceled', 'failed'].includes(s)) return '#dc2626'
  return '#475569'
}

function getTodayDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Dashboard() {
  const [routes, setRoutes] = useState([])
  const [pickups, setPickups] = useState([])
  const [items, setItems] = useState([])
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [loadingPickups, setLoadingPickups] = useState(true)
  const [loadingItems, setLoadingItems] = useState(true)
  const [errorRoutes, setErrorRoutes] = useState('')
  const [errorPickups, setErrorPickups] = useState('')
  const [errorItems, setErrorItems] = useState('')
  
  // Filter state - defaults to today and all statuses
  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const [statusFilter, setStatusFilter] = useState('')
  
  // Selection state for filtering
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [selectedPickup, setSelectedPickup] = useState(null)
  
  // Modal state for item details
  const [selectedItem, setSelectedItem] = useState(null)
  const [showItemModal, setShowItemModal] = useState(false)

  // Create items lookup map
  const itemsMap = useMemo(() => {
    return Object.fromEntries(items.map(item => [item.id, item]))
  }, [items])

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      setLoadingRoutes(true)
      setErrorRoutes('')
      try {
        const snap = await getDocs(collection(db, 'routes'))
        if (cancelled) return
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Enrich with driver profile
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
            driver: fullName || r.driver || 'Unassigned',
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
            const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            return { ...p, items }
          } catch (error) {
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

    async function loadItems() {
      setLoadingItems(true)
      setErrorItems('')
      try {
        const snap = await getDocs(collection(db, 'items'))
        if (cancelled) return
        const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setItems(allItems)
      } catch (err) {
        if (!cancelled) setErrorItems(err?.message || 'Failed to load items')
      } finally {
        if (!cancelled) setLoadingItems(false)
      }
    }

    loadRoutes()
    loadPickups()
    loadItems()
    return () => { cancelled = true }
  }, [])

  // Filter data based on selected date, status, and selections
  const filteredData = useMemo(() => {
    const filterDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null
    
    // Filter routes
    const filteredRoutes = routes.filter(r => {
      // Check date match using the 'date' field (string format YYYY-MM-DD)
      const dateMatch = r.date === selectedDate
      
      // Check status match
      const routeStatus = (r.status || '').toString().toLowerCase()
      const statusMatch = !statusFilter || routeStatus === statusFilter.toLowerCase()
      
      return dateMatch && statusMatch
    }).sort((a, b) => {
      const timeA = toDateMaybe(a.scheduledTime || a.scheduledAt)
      const timeB = toDateMaybe(b.scheduledTime || b.scheduledAt)
      if (!timeA) return 1
      if (!timeB) return -1
      return timeA - timeB
    })

    // Filter pickups - if a route is selected, only show its pickups
    let filteredPickups = []
    
    if (selectedRoute) {
      // Show only pickups from the selected route
      if (Array.isArray(selectedRoute.pickups)) {
        selectedRoute.pickups.forEach(pickupRef => {
          const pickupId = typeof pickupRef === 'string' ? pickupRef : pickupRef.pickupId
          const pickup = pickups.find(p => p.id === pickupId)
          if (pickup) {
            filteredPickups.push(pickup)
          }
        })
      }
    } else {
      // Show all pickups for the selected date/status
      filteredPickups = pickups.filter(p => {
        // Check date match
        const pDate = toDateMaybe(p.scheduledTime || p.scheduledTimeLocal || p.scheduledAt || p.date)
        const dateMatch = pDate && filterDate && isSameDay(pDate, filterDate)
        
        // Check status match
        const pickupStatus = (p.status || '').toString().toLowerCase()
        const statusMatch = !statusFilter || pickupStatus === statusFilter.toLowerCase()
        
        return dateMatch && statusMatch
      })
    }
    
    filteredPickups.sort((a, b) => {
      const timeA = toDateMaybe(a.scheduledTime || a.scheduledTimeLocal || a.scheduledAt)
      const timeB = toDateMaybe(b.scheduledTime || b.scheduledTimeLocal || b.scheduledAt)
      if (!timeA) return 1
      if (!timeB) return -1
      return timeA - timeB
    })

    // Filter items - if a pickup is selected, only show its items
    const filteredItems = []
    
    if (selectedPickup) {
      // Show only items from the selected pickup
      // First, try to get items from the pickup's subcollection (pickup.items array)
      if (Array.isArray(selectedPickup.items) && selectedPickup.items.length > 0) {
        selectedPickup.items.forEach(item => {
          // Items from pickup subcollection are already full objects, not references
          if (item && typeof item === 'object') {
            filteredItems.push({
              ...item,
              pickupId: selectedPickup.id,
              pickupReference: selectedPickup.reference || selectedPickup.customerName || selectedPickup.name,
              pickupAddress: formatPickupAddress(selectedPickup),
            })
          }
        })
      }
      
      // Also check the global items collection for items with matching pickupId
      items.forEach(item => {
        if (item.pickupId === selectedPickup.id) {
          // Avoid duplicates
          if (!filteredItems.find(i => i.id === item.id)) {
            filteredItems.push({
              ...item,
              pickupId: selectedPickup.id,
              pickupReference: selectedPickup.reference || selectedPickup.customerName || selectedPickup.name,
              pickupAddress: formatPickupAddress(selectedPickup),
            })
          }
        }
      })
    } else {
      // Show all items from filtered pickups
      filteredPickups.forEach(pickup => {
        if (Array.isArray(pickup.items)) {
          pickup.items.forEach(item => {
            // Items from pickup subcollection are already full objects, not references
            if (item && typeof item === 'object') {
              const itemStatus = (item.status || '').toString().toLowerCase()
              const statusMatch = !statusFilter || itemStatus === statusFilter.toLowerCase()
              
              if (statusMatch) {
                filteredItems.push({
                ...item,
                pickupId: pickup.id,
                pickupReference: pickup.reference || pickup.customerName || pickup.name,
                pickupAddress: formatPickupAddress(pickup),
                })
              }
            }
          })
        }
      })
    }

    return { routes: filteredRoutes, pickups: filteredPickups, items: filteredItems }
  }, [routes, pickups, items, itemsMap, selectedDate, statusFilter, selectedRoute, selectedPickup])

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--accent-color)' }}>Daily overview of routes, pickups, and items</p>
      </section>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <label htmlFor="date-filter" style={{ display: 'block', fontWeight: 600, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
              Date
            </label>
            <input
              id="date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <label htmlFor="status-filter" style={{ display: 'block', fontWeight: 600, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            >
              <option value="">All Statuses</option>
                      <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                </select>
              </div>

          <button
            onClick={() => {
              setSelectedDate(getTodayDateString())
              setStatusFilter('')
              setSelectedRoute(null)
              setSelectedPickup(null)
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            Reset to Today
          </button>
            </div>

        {/* Active Filters Display */}
        {(selectedRoute || selectedPickup) && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Active Filters:</span>
            {selectedRoute && (
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.5rem 0.75rem', 
                backgroundColor: 'var(--primary-color)', 
                color: 'white', 
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600
              }}>
                Route: {selectedRoute.name || selectedRoute.title || 'Route'}
                <button
                        onClick={() => { 
                    setSelectedRoute(null)
                    setSelectedPickup(null)
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '0.15rem 0.4rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            {selectedPickup && (
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.5rem 0.75rem', 
                backgroundColor: '#0284c7', 
                color: 'white', 
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600
              }}>
                Pickup: {selectedPickup.reference || selectedPickup.customerName || selectedPickup.name || 'Pickup'}
                <button
                  onClick={() => setSelectedPickup(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '0.15rem 0.4rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              </div>
              )}
            </div>
        )}
                </div>

      {/* Three Column Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth >= 1200 ? 'repeat(3, 1fr)' : window.innerWidth >= 768 ? 'repeat(2, 1fr)' : '1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Routes Column */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Routes
            <span style={{ 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '999px', 
              fontSize: '0.85rem', 
              fontWeight: 700 
            }}>
              {filteredData.routes.length}
            </span>
          </h2>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1rem', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            flex: 1,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 300px)',
            minHeight: '400px'
          }}>
            {loadingRoutes && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
            {errorRoutes && <p style={{ color: 'salmon' }}>{errorRoutes}</p>}
            {!loadingRoutes && !errorRoutes && (
              filteredData.routes.length ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredData.routes.map(r => {
                    const startTime = toDateMaybe(r.scheduledTime || r.scheduledAt || r.scheduledWindowStart)
                    const endTime = toDateMaybe(r.endTime || r.scheduledWindowEnd)
                    const status = (r.status || 'unknown').toString()
                    
                    const isSelected = selectedRoute?.id === r.id
                            
                            return (
                      <li 
                        key={r.id} 
                        onClick={() => {
                          if (selectedRoute?.id === r.id) {
                            setSelectedRoute(null)
                            setSelectedPickup(null)
                          } else {
                            setSelectedRoute(r)
                            setSelectedPickup(null)
                          }
                        }}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '0.5rem',
                          padding: '0.875rem', 
                          border: isSelected ? '2px solid var(--primary-color)' : '2px solid var(--border-color)', 
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(80, 200, 120, 0.05)' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--primary-color)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.boxShadow = 'none'
                          }
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary-color)' }}>
                            {r.name || r.title || 'Route'}
                                    </div>
                          <span style={{ 
                            backgroundColor: statusPillColor(status), 
                            color: 'white', 
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '999px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {status}
                          </span>
                                </div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                          👤 {r.driver}
                        </div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                          ⏰ {formatTimeRange(startTime, endTime)}
                        </div>
                        {r.pickups && r.pickups.length > 0 && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                            📦 {r.pickups.length} {r.pickups.length === 1 ? 'pickup' : 'pickups'}
                          </div>
                        )}
                              </li>
                            )
                          })}
                        </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
                  No routes found
                </p>
              )
                    )}
                  </div>
        </section>

        {/* Pickups Column */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Pickups
            {selectedRoute && <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 400 }}>(from selected route)</span>}
            <span style={{ 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '999px', 
              fontSize: '0.85rem', 
              fontWeight: 700 
            }}>
              {filteredData.pickups.length}
            </span>
          </h2>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1rem', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            flex: 1,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 300px)',
            minHeight: '400px'
          }}>
            {loadingPickups && <p style={{ color: 'var(--accent-color)' }}>Loading pickups…</p>}
            {errorPickups && <p style={{ color: 'salmon' }}>{errorPickups}</p>}
            {!loadingPickups && !errorPickups && (
              filteredData.pickups.length ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredData.pickups.map(p => {
                    const startTime = toDateMaybe(p.scheduledWindowStart || p.windowStart)
                    const endTime = toDateMaybe(p.scheduledWindowEnd || p.windowEnd)
                    const status = (p.status || 'unknown').toString()
                    const address = formatPickupAddress(p)
                    
                    const isSelected = selectedPickup?.id === p.id

                            return (
                      <li 
                        key={p.id} 
                        onClick={() => {
                          if (selectedPickup?.id === p.id) {
                            setSelectedPickup(null)
                          } else {
                            setSelectedPickup(p)
                          }
                        }}
                                            style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '0.5rem',
                          padding: '0.875rem', 
                          border: isSelected ? '2px solid #0284c7' : '2px solid var(--border-color)', 
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.05)' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#0284c7'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.boxShadow = 'none'
                          }
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary-color)' }}>
                            {p.reference || p.customerName || p.name || 'Pickup'}
                                        </div>
                          <span style={{ 
                            backgroundColor: statusPillColor(status), 
                            color: 'white', 
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '999px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {status}
                          </span>
                                      </div>
                        {address && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                            📍 {address}
                                    </div>
                                  )}
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                          ⏰ {formatTimeRange(startTime, endTime)}
                                  </div>
                        {p.items && p.items.length > 0 && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                            📦 {p.items.length} {p.items.length === 1 ? 'item' : 'items'}
                                </div>
                        )}
                              </li>
                            )
                          })}
                        </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
                  No pickups found
                </p>
              )
                    )}
                  </div>
        </section>

        {/* Items Column */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Items
            {selectedPickup && <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 400 }}>(from selected pickup)</span>}
            <span style={{ 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '999px', 
              fontSize: '0.85rem', 
              fontWeight: 700 
            }}>
              {filteredData.items.length}
            </span>
          </h2>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1rem', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            flex: 1,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 300px)',
            minHeight: '400px'
          }}>
            {loadingItems && <p style={{ color: 'var(--accent-color)' }}>Loading items…</p>}
            {errorItems && <p style={{ color: 'salmon' }}>{errorItems}</p>}
            {!loadingItems && !errorItems && (
              filteredData.items.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredData.items.map(item => {
                    const status = (item.status || 'unknown').toString()
                    
                return (
                      <li 
                        key={item.id} 
                        onClick={() => {
                          setSelectedItem(item)
                          setShowItemModal(true)
                        }}
                        style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '0.5rem',
                        padding: '0.875rem', 
                        border: '2px solid var(--border-color)', 
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary-color)', flex: 1 }}>
                        {item.name}
                      </div>
                          <span style={{ 
                            backgroundColor: statusPillColor(status), 
                            color: 'white', 
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '999px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {status}
                          </span>
                        </div>
                      {(item.photo?.url || item.driverPhoto?.url) && (
                              <img 
                                src={item.photo?.url || item.driverPhoto?.url} 
                                alt={item.name || 'Item'} 
                                style={{ 
                              width: '100%', 
                                  height: '120px', 
                                  objectFit: 'cover', 
                              borderRadius: '6px', 
                                  border: '1px solid var(--border-color)' 
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                        )}
                        {item.description && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                            {item.description}
                        </div>
                      )}
                        {item.dropoffLocation?.type && (
                          <div style={{ 
                            color: '#002D47', 
                            fontSize: '0.85rem', 
                            fontWeight: 600,
                            backgroundColor: 'rgba(0, 45, 71, 0.1)',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            📍 {item.dropoffLocation.type}
                          </div>
                        )}
                        {item.requiresBox && (
                          <div style={{ 
                            color: '#00A7B3', 
                            fontSize: '0.85rem', 
                            fontWeight: 600,
                            backgroundColor: 'rgba(0, 167, 179, 0.1)',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            📦 Requires a box
                          </div>
                        )}
                        {item.pickupAddress && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>
                            📍 {item.pickupAddress}
                    </div>
                        )}
                        {item.estimatedSize && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>
                            📏 Size: {item.estimatedSize}
                    </div>
                        )}
                        {item.estimatedWeight && (
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>
                            ⚖️ Weight: {item.estimatedWeight}
                    </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ color: 'var(--accent-color)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
                  No items found
                </p>
              )
            )}
            </div>
        </section>
          </div>

      {/* Item Details Modal */}
      {showItemModal && selectedItem && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowItemModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              zIndex: 1
            }}>
              <h2 style={{ margin: 0, color: 'var(--secondary-color)' }}>Item Details</h2>
              <button
                onClick={() => setShowItemModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--accent-color)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Status Badge */}
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ 
                  backgroundColor: statusPillColor(selectedItem.status), 
                  color: 'white', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '999px', 
                  fontSize: '0.9rem', 
                  fontWeight: 700
                }}>
                  {selectedItem.status}
                </span>
              </div>

              {/* Images Section */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: selectedItem.qrCode?.url ? '1fr 1fr' : '1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {selectedItem.photo?.url && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
                      Package Photo
                    </h3>
                    <img 
                      src={selectedItem.photo.url} 
                      alt="Package" 
                      style={{ 
                        width: '100%', 
                        height: '250px', 
                        objectFit: 'cover', 
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                  </div>
                )}
                {selectedItem.qrCode?.url && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
                      QR Code
                    </h3>
                    <img 
                      src={selectedItem.qrCode.url} 
                      alt="QR Code" 
                      style={{ 
                        width: '100%', 
                        height: '250px', 
                        objectFit: 'contain', 
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#f9fafb'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {/* Packaging Status */}
                {selectedItem.packagingStatus && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                      Packaging Status
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>
                      {selectedItem.packagingStatus}
                    </div>
                  </div>
                )}

                {/* Estimated Size */}
                {selectedItem.estimatedSize && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                      📏 Estimated Size
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>
                      {selectedItem.estimatedSize}
                    </div>
                  </div>
                )}

                {/* Estimated Weight */}
                {selectedItem.estimatedWeight && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                      ⚖️ Estimated Weight
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>
                      {selectedItem.estimatedWeight}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                {selectedItem.quantity && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                      Quantity
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>
                      {selectedItem.quantity}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedItem.description && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                    Description
                  </div>
                  <div style={{ color: 'var(--secondary-color)', lineHeight: '1.5' }}>
                    {selectedItem.description}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedItem.notes && selectedItem.notes.trim() && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                    Notes
                  </div>
                  <div style={{ color: 'var(--secondary-color)', lineHeight: '1.5' }}>
                    {selectedItem.notes}
                  </div>
                </div>
              )}

              {/* Requires Box */}
              {selectedItem.requiresBox && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(0, 167, 179, 0.1)', 
                  borderRadius: '8px',
                  border: '1px solid #00A7B3',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📦</span>
                  <span style={{ color: '#00A7B3', fontWeight: 600 }}>
                    Requires a box
                  </span>
                </div>
              )}

              {/* Dropoff Location */}
              {selectedItem.dropoffLocation && (selectedItem.dropoffLocation.type || selectedItem.dropoffLocation.address) && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                    📍 Dropoff Location
                  </div>
                  <div style={{ color: 'var(--secondary-color)' }}>
                    {selectedItem.dropoffLocation.type && (
                      <div style={{ fontWeight: 600, marginBottom: selectedItem.dropoffLocation.address ? '0.25rem' : '0' }}>
                        {selectedItem.dropoffLocation.type}
                      </div>
                    )}
                    {selectedItem.dropoffLocation.address && selectedItem.dropoffLocation.address !== null && (
                      <div>
                        {selectedItem.dropoffLocation.address}
                        {selectedItem.dropoffLocation.city && selectedItem.dropoffLocation.state && (
                          <>, {selectedItem.dropoffLocation.city}, {selectedItem.dropoffLocation.state} {selectedItem.dropoffLocation.zip}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pickup Address */}
              {selectedItem.pickupAddress && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                    📍 Pickup Address
                  </div>
                  <div style={{ color: 'var(--secondary-color)' }}>
                    {selectedItem.pickupAddress}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              {(selectedItem.createdAt || selectedItem.updatedAt) && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  {selectedItem.createdAt && (
                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                        Created At
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--secondary-color)', fontWeight: 600 }}>
                        {new Date(selectedItem.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </div>
                  )}
                  {selectedItem.updatedAt && (
                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                        Updated At
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--secondary-color)', fontWeight: 600 }}>
                        {new Date(selectedItem.updatedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Dashboard
