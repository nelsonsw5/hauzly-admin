import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
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
  if (typeof value === 'number') {
    return new Date(value)
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return !isNaN(d.getTime()) ? d : null
  }
  return null
}

function statusPillColor(status) {
  const s = (status || '').toString().toLowerCase()
  if (['complete', 'completed', 'done'].includes(s)) return '#16a34a'
  if (['active', 'in_progress', 'in-progress', 'ongoing', 'received'].includes(s)) return '#0284c7'
  if (['scheduled', 'pending', 'upcoming'].includes(s)) return '#a16207'
  if (['cancelled', 'canceled', 'failed'].includes(s)) return '#dc2626'
  return '#475569'
}

function RouteCalendar() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [updatingDriver, setUpdatingDriver] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [showDayModal, setShowDayModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedPickup, setSelectedPickup] = useState(null)
  const [availableRoutes, setAvailableRoutes] = useState([])
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      setLoading(true)
      setError('')
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

        // Enrich routes with pickup details
        const withDriver = await Promise.all(all.map(async (r) => {
          const u = r.driverId ? driverMap[r.driverId] : null
          const fullName = u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : ''
          const scheduledDate = toDateMaybe(r.scheduledAt || r.date || r.scheduledDate)
          
          // Enrich pickups with customer and address info
          let enrichedPickups = r.pickups || []
          if (Array.isArray(enrichedPickups) && enrichedPickups.length > 0) {
            enrichedPickups = await Promise.all(enrichedPickups.map(async (pickup) => {
              try {
                const pickupId = typeof pickup === 'string' ? pickup : pickup.pickupId
                if (!pickupId) return pickup
                
                // Get pickup document
                const pickupDoc = await getDoc(doc(db, 'pickups', pickupId))
                if (!pickupDoc.exists()) return pickup
                
                const pickupData = pickupDoc.data()
                const customerId = pickupData.customerId
                
                // Get customer info
                let customerName = 'Unknown Customer'
                if (customerId) {
                  const customerDoc = await getDoc(doc(db, 'users', customerId))
                  if (customerDoc.exists()) {
                    const customerData = customerDoc.data()
                    customerName = [customerData.firstName, customerData.lastName]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || 'Unknown Customer'
                  }
                }
                
                // Format address
                let address = 'No address'
                if (pickupData.pickupAddress) {
                  const addr = pickupData.pickupAddress
                  const parts = [
                    addr.streetAddress || addr.street,
                    addr.city,
                    addr.state,
                    addr.zip
                  ].filter(Boolean)
                  address = parts.join(', ') || 'No address'
                }
                
                return {
                  pickupId,
                  customerName,
                  address,
                  ...pickupData
                }
              } catch (err) {
                console.error('Error enriching pickup:', err)
                return pickup
              }
            }))
          }
          
          return {
            ...r,
            driver: fullName || r.driver || 'Unassigned',
            driverProfile: u || undefined,
            scheduledDate,
            pickups: enrichedPickups
          }
        }))

        setRoutes(withDriver)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load routes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRoutes()
    return () => { cancelled = true }
  }, [])

  // Calendar logic
  const { year, month } = useMemo(() => ({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  }), [currentDate])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startingDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days = []
    
    // Previous month's trailing days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ type: 'empty', key: `empty-start-${i}` })
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateString = date.toISOString().split('T')[0] // Format: YYYY-MM-DD
      
      const routesOnDay = routes.filter(route => {
        // Use the 'date' field (string format) for matching
        if (route.date) {
          return route.date === dateString
        }
        // Fallback to scheduledDate if date field doesn't exist
        if (!route.scheduledDate) return false
        return (
          route.scheduledDate.getFullYear() === year &&
          route.scheduledDate.getMonth() === month &&
          route.scheduledDate.getDate() === day
        )
      })

      days.push({
        type: 'day',
        date,
        day,
        routes: routesOnDay,
        key: `day-${day}`,
      })
    }

    return days
  }, [year, month, routes])

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const closeModal = () => {
    setSelectedRoute(null)
  }

  const openDayModal = (dayInfo) => {
    setSelectedDay(dayInfo)
    setShowDayModal(true)
  }

  const closeDayModal = () => {
    setShowDayModal(false)
    setSelectedDay(null)
  }

  const openRouteFromDay = (route) => {
    setSelectedRoute(route)
    // Keep day modal open in background
  }

  const openDriverModal = async () => {
    setShowDriverModal(true)
    setLoadingDrivers(true)
    try {
      // Fetch all users with type='driver'
      const usersRef = collection(db, 'users')
      const snapshot = await getDocs(usersRef)
      const driverList = []
      snapshot.forEach(doc => {
        const data = doc.data()
        if (data.type === 'driver') {
          driverList.push({
            id: doc.id,
            name: [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Driver',
            ...data
          })
        }
      })
      // Sort by name
      driverList.sort((a, b) => a.name.localeCompare(b.name))
      setDrivers(driverList)
    } catch (err) {
      console.error('Error loading drivers:', err)
      alert('Failed to load drivers')
    } finally {
      setLoadingDrivers(false)
    }
  }

  const closeDriverModal = () => {
    setShowDriverModal(false)
  }

  const openReassignModal = (pickup) => {
    setSelectedPickup(pickup)
    
    // Get all routes for the same day as the selected route
    if (selectedRoute && selectedRoute.scheduledDate) {
      const sameDay = routes.filter(r => {
        if (!r.scheduledDate) return false
        return (
          r.scheduledDate.getFullYear() === selectedRoute.scheduledDate.getFullYear() &&
          r.scheduledDate.getMonth() === selectedRoute.scheduledDate.getMonth() &&
          r.scheduledDate.getDate() === selectedRoute.scheduledDate.getDate() &&
          r.id !== selectedRoute.id // Exclude current route
        )
      })
      
      // Filter routes that overlap with pickup time (if available)
      // For now, show all routes on the same day
      setAvailableRoutes(sameDay)
    } else if (selectedRoute && selectedRoute.date) {
      // Use date string if scheduledDate not available
      const sameDay = routes.filter(r => {
        return r.date === selectedRoute.date && r.id !== selectedRoute.id
      })
      setAvailableRoutes(sameDay)
    }
    
    setShowReassignModal(true)
  }

  const closeReassignModal = () => {
    setShowReassignModal(false)
    setSelectedPickup(null)
    setAvailableRoutes([])
  }

  const reassignPickup = async (newRouteId) => {
    if (!selectedPickup || !selectedRoute || !newRouteId) return
    
    setReassigning(true)
    try {
      const pickupId = typeof selectedPickup === 'string' ? selectedPickup : selectedPickup.pickupId
      
      // Remove pickup from current route
      const currentRouteRef = doc(db, 'routes', selectedRoute.id)
      const currentRouteDoc = await getDoc(currentRouteRef)
      
      if (currentRouteDoc.exists()) {
        const currentPickups = currentRouteDoc.data().pickups || []
        const updatedPickups = currentPickups.filter(p => {
          const pId = typeof p === 'string' ? p : p.pickupId
          return pId !== pickupId
        })
        
        await updateDoc(currentRouteRef, {
          pickups: updatedPickups,
          updatedAt: new Date()
        })
      }
      
      // Add pickup to new route
      const newRouteRef = doc(db, 'routes', newRouteId)
      const newRouteDoc = await getDoc(newRouteRef)
      
      if (newRouteDoc.exists()) {
        const newPickups = newRouteDoc.data().pickups || []
        const pickupData = typeof selectedPickup === 'string' 
          ? { pickupId: selectedPickup }
          : { pickupId: selectedPickup.pickupId }
        
        await updateDoc(newRouteRef, {
          pickups: [...newPickups, pickupData],
          updatedAt: new Date()
        })
      }
      
      // Update local state
      const updatedCurrentRoute = {
        ...selectedRoute,
        pickups: selectedRoute.pickups.filter(p => {
          const pId = typeof p === 'string' ? p : p.pickupId
          return pId !== pickupId
        })
      }
      
      setSelectedRoute(updatedCurrentRoute)
      setRoutes(routes.map(r => {
        if (r.id === selectedRoute.id) {
          return updatedCurrentRoute
        }
        if (r.id === newRouteId) {
          return {
            ...r,
            pickups: [...(r.pickups || []), typeof selectedPickup === 'string' ? { pickupId: selectedPickup } : selectedPickup]
          }
        }
        return r
      }))
      
      closeReassignModal()
      setSuccessMessage('Pickup reassigned successfully!')
      setShowSuccessModal(true)
      
      setTimeout(() => {
        setShowSuccessModal(false)
      }, 3000)
    } catch (err) {
      console.error('Error reassigning pickup:', err)
      setSuccessMessage(`Failed to reassign pickup: ${err.message}`)
      setShowSuccessModal(true)
    } finally {
      setReassigning(false)
    }
  }

  const changeDriver = async (newDriverId, newDriverName) => {
    if (!selectedRoute) return
    
    setUpdatingDriver(true)
    try {
      // Update Firestore
      const routeRef = doc(db, 'routes', selectedRoute.id)
      await updateDoc(routeRef, {
        driverId: newDriverId,
        driverName: newDriverName,
        updatedAt: new Date()
      })

      // Update local state
      const updatedRoute = {
        ...selectedRoute,
        driverId: newDriverId,
        driverName: newDriverName,
        driver: newDriverName
      }
      setSelectedRoute(updatedRoute)
      setRoutes(routes.map(r => r.id === selectedRoute.id ? updatedRoute : r))
      
      closeDriverModal()
      setSuccessMessage(`Driver successfully changed to ${newDriverName}`)
      setShowSuccessModal(true)
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false)
      }, 3000)
    } catch (err) {
      console.error('Error updating driver:', err)
      setSuccessMessage(`Failed to update driver: ${err.message}`)
      setShowSuccessModal(true)
    } finally {
      setUpdatingDriver(false)
    }
  }

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (showReassignModal) {
          closeReassignModal()
        } else if (showDriverModal) {
          closeDriverModal()
        } else if (selectedRoute) {
          closeModal()
        } else if (showDayModal) {
          closeDayModal()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRoute, showDriverModal, showDayModal, showReassignModal])

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Route Calendar</h1>
        <p style={{ color: 'var(--accent-color)' }}>View routes scheduled by date</p>
      </section>

      {loading && <p style={{ color: 'var(--accent-color)' }}>Loading routes…</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ backgroundColor: 'white', padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
          {/* Calendar Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: 'var(--secondary-color)', margin: 0, fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>{monthName}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={goToPreviousMonth}
                style={{ 
                  padding: 'clamp(0.4rem, 2vw, 0.5rem) clamp(0.75rem, 3vw, 1rem)', 
                  backgroundColor: 'var(--secondary-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'clamp(0.85rem, 2.5vw, 1rem)'
                }}
              >
                ← Prev
              </button>
              <button 
                onClick={goToToday}
                style={{ 
                  padding: 'clamp(0.4rem, 2vw, 0.5rem) clamp(0.75rem, 3vw, 1rem)', 
                  backgroundColor: 'var(--primary-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'clamp(0.85rem, 2.5vw, 1rem)'
                }}
              >
                Today
              </button>
              <button 
                onClick={goToNextMonth}
                style={{ 
                  padding: 'clamp(0.4rem, 2vw, 0.5rem) clamp(0.75rem, 3vw, 1rem)', 
                  backgroundColor: 'var(--secondary-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'clamp(0.85rem, 2.5vw, 1rem)'
                }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Day of week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'clamp(2px, 1vw, 8px)', marginBottom: 'clamp(2px, 1vw, 8px)' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div 
                key={day} 
                style={{ 
                  padding: 'clamp(0.2rem, 1.5vw, 0.5rem)', 
                  textAlign: 'center', 
                  fontWeight: 700, 
                  color: 'var(--secondary-color)',
                  fontSize: 'clamp(0.65rem, 2vw, 0.9rem)'
                }}
              >
                {window.innerWidth < 640 ? day.charAt(0) : day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'clamp(2px, 1vw, 8px)' }}>
            {calendarDays.map(dayInfo => {
              if (dayInfo.type === 'empty') {
                return <div key={dayInfo.key} style={{ minHeight: 'clamp(50px, 12vw, 100px)' }} />
              }

              const isToday = 
                dayInfo.date.getFullYear() === new Date().getFullYear() &&
                dayInfo.date.getMonth() === new Date().getMonth() &&
                dayInfo.date.getDate() === new Date().getDate()

              const isMobile = window.innerWidth < 640

              return (
                <div
                  key={dayInfo.key}
                  onClick={() => openDayModal(dayInfo)}
                  style={{
                    border: isToday ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    borderRadius: isMobile ? '4px' : 'clamp(4px, 1.5vw, 8px)',
                    padding: isMobile ? '0.2rem' : 'clamp(0.25rem, 1.5vw, 0.5rem)',
                    minHeight: isMobile ? '50px' : 'clamp(60px, 12vw, 100px)',
                    backgroundColor: isToday ? 'rgba(80, 200, 120, 0.05)' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (window.innerWidth >= 768) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Day number */}
                  <div style={{ 
                    fontWeight: 700, 
                    color: isToday ? 'var(--primary-color)' : 'var(--secondary-color)', 
                    marginBottom: isMobile ? '0.1rem' : 'clamp(0.15rem, 1vw, 0.5rem)', 
                    fontSize: isMobile ? '0.7rem' : 'clamp(0.75rem, 2vw, 0.9rem)',
                    lineHeight: 1.2
                  }}>
                    {dayInfo.day}
                  </div>
                  
                  {/* Route indicators */}
                  {isMobile ? (
                    // Mobile: Show dots for routes
                    dayInfo.routes.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '2px', 
                        marginTop: 'auto',
                        justifyContent: 'center',
                        paddingTop: '0.15rem'
                      }}>
                        {dayInfo.routes.slice(0, 6).map((route, idx) => (
                          <div
                            key={route.id}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: statusPillColor(route.status),
                              flexShrink: 0
                            }}
                            title={route.driver}
                          />
                        ))}
                        {dayInfo.routes.length > 6 && (
                          <div style={{ 
                            fontSize: '0.55rem', 
                            color: 'var(--accent-color)', 
                            fontWeight: 600,
                            lineHeight: 1
                          }}>
                            +{dayInfo.routes.length - 6}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    // Desktop: Show route names
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.15rem, 0.5vw, 0.25rem)', overflow: 'auto' }}>
                      {dayInfo.routes.slice(0, 3).map(route => (
                        <div
                          key={route.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedRoute(route)
                          }}
                          style={{
                            padding: 'clamp(0.2rem, 1vw, 0.35rem)',
                            backgroundColor: statusPillColor(route.status),
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: 'clamp(0.65rem, 1.8vw, 0.75rem)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`${route.name || route.title || 'Route'} - ${route.driver}`}
                        >
                          {route.driver}
                        </div>
                      ))}
                      {dayInfo.routes.length > 3 && (
                        <div style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.7rem)', color: 'var(--accent-color)', fontWeight: 600, textAlign: 'center' }}>
                          +{dayInfo.routes.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ marginTop: 'clamp(1rem, 3vw, 1.5rem)', padding: 'clamp(0.75rem, 2.5vw, 1rem)', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'clamp(6px, 1.5vw, 8px)' }}>
            <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)', fontSize: 'clamp(0.9rem, 2.2vw, 1rem)' }}>Status Legend</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.5rem)' }}>
                <div style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', backgroundColor: '#a16207', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>Scheduled</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.5rem)' }}>
                <div style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', backgroundColor: '#0284c7', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>Active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.5rem)' }}>
                <div style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', backgroundColor: '#16a34a', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>Completed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.5rem)' }}>
                <div style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', backgroundColor: '#dc2626', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>Cancelled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day View Modal */}
      {showDayModal && selectedDay && (
        <div onClick={closeDayModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(800px, 100%)', maxHeight: '90vh', borderRadius: 'clamp(8px, 2vw, 10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(0.75rem, 2.5vw, 1rem)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: 'var(--secondary-color)' }}>
                  {selectedDay.date.toLocaleDateString('en-US', { weekday: window.innerWidth < 640 ? 'short' : 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', color: 'var(--accent-color)', marginTop: '0.25rem' }}>
                  {selectedDay.routes.length} {selectedDay.routes.length === 1 ? 'route' : 'routes'} scheduled
                </div>
              </div>
              <button onClick={closeDayModal} style={{ background: 'transparent', border: 'none', fontSize: 'clamp(1.3rem, 4vw, 1.5rem)', cursor: 'pointer', color: 'var(--secondary-color)', padding: '0.25rem', minWidth: '32px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', overflow: 'auto', flex: 1 }}>
              {selectedDay.routes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent-color)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No routes scheduled for this day</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedDay.routes
                    .sort((a, b) => {
                      const timeA = toDateMaybe(a.scheduledTime || a.scheduledAt)
                      const timeB = toDateMaybe(b.scheduledTime || b.scheduledAt)
                      if (!timeA) return 1
                      if (!timeB) return -1
                      return timeA - timeB
                    })
                    .map(route => {
                      const startTime = toDateMaybe(route.scheduledTime || route.scheduledAt || route.scheduledWindowStart)
                      const endTime = toDateMaybe(route.endTime || route.scheduledWindowEnd)
                      
                      return (
                        <div
                          key={route.id}
                          onClick={() => openRouteFromDay(route)}
                          style={{
                            padding: 'clamp(0.75rem, 2.5vw, 1.25rem)',
                            backgroundColor: 'white',
                            border: '2px solid var(--border-color)',
                            borderRadius: 'clamp(6px, 2vw, 10px)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: window.innerWidth < 640 ? 'column' : 'row',
                            gap: 'clamp(0.5rem, 2vw, 1rem)',
                            alignItems: window.innerWidth < 640 ? 'stretch' : 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (window.innerWidth >= 768) {
                              e.currentTarget.style.borderColor = 'var(--primary-color)'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                              e.currentTarget.style.transform = 'translateY(-2px)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.boxShadow = 'none'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          {/* Time Column */}
                          <div style={{ 
                            minWidth: window.innerWidth < 640 ? 'auto' : '120px',
                            padding: 'clamp(0.5rem, 2vw, 0.75rem)',
                            backgroundColor: 'rgba(0, 191, 179, 0.08)',
                            borderRadius: 'clamp(4px, 1.5vw, 8px)',
                            textAlign: 'center'
                          }}>
                            <div style={{ 
                              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', 
                              fontWeight: 700, 
                              color: 'var(--primary-color)',
                              marginBottom: '0.25rem'
                            }}>
                              {startTime ? startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'No time'}
                            </div>
                            {endTime && (
                              <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>
                                to {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                            )}
                          </div>

                          {/* Route Info Column */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 1.5vw, 0.75rem)', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', color: 'var(--secondary-color)' }}>
                                {route.name || route.title || 'Route'}
                              </div>
                              <span style={{ 
                                backgroundColor: statusPillColor(route.status), 
                                color: 'white', 
                                padding: 'clamp(0.2rem, 1vw, 0.25rem) clamp(0.4rem, 1.5vw, 0.6rem)', 
                                borderRadius: '999px', 
                                fontSize: 'clamp(0.7rem, 1.8vw, 0.75rem)', 
                                fontWeight: 700 
                              }}>
                                {route.status || 'Unknown'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: 'clamp(0.9rem, 2.2vw, 1rem)' }}>👤</span>
                              <span style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)', color: 'var(--accent-color)', fontWeight: 600 }}>
                                {route.driver}
                              </span>
                            </div>
                            {route.pickups && Array.isArray(route.pickups) && route.pickups.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: 'clamp(0.9rem, 2.2vw, 1rem)' }}>📦</span>
                                <span style={{ fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: 'var(--accent-color)' }}>
                                  {route.pickups.length} {route.pickups.length === 1 ? 'pickup' : 'pickups'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Arrow */}
                          {window.innerWidth >= 640 && (
                            <div style={{ color: 'var(--primary-color)', fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 700 }}>
                              →
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for route details */}
      {selectedRoute && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(600px, 100%)', maxHeight: '90vh', borderRadius: 'clamp(8px, 2vw, 10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(0.75rem, 2.5vw, 1rem)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: 'var(--secondary-color)' }}>Route Details</div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', fontSize: 'clamp(1.3rem, 4vw, 1.5rem)', cursor: 'pointer', color: 'var(--secondary-color)', padding: '0.25rem', minWidth: '32px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', overflow: 'auto', color: 'var(--accent-color)' }}>
              <div style={{ marginBottom: 'clamp(1rem, 3vw, 1.5rem)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'clamp(0.75rem, 2vw, 1rem)', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: 700, fontSize: 'clamp(1.1rem, 3.5vw, 1.3rem)', color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
                      {selectedRoute.name || selectedRoute.title || 'Route'}
                    </div>
                    <div style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)', marginBottom: '0.25rem' }}>
                      <strong>Driver:</strong> {selectedRoute.driver}
                    </div>
                    <div style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)', marginBottom: '0.25rem' }}>
                      <strong>Date:</strong> {selectedRoute.scheduledDate ? selectedRoute.scheduledDate.toLocaleDateString('en-US', { weekday: window.innerWidth < 640 ? 'short' : 'long', year: 'numeric', month: 'long', day: 'numeric' }) : (selectedRoute.date || 'Not scheduled')}
                    </div>
                    {(selectedRoute.scheduledTime || selectedRoute.scheduledWindowStart || selectedRoute.readableStartTime) && (
                      <div style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)', marginBottom: '0.25rem' }}>
                        <strong>Start Time:</strong> {
                          selectedRoute.readableStartTime || 
                          toDateMaybe(selectedRoute.scheduledTime || selectedRoute.scheduledWindowStart)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) ||
                          'Not set'
                        }
                      </div>
                    )}
                    {(selectedRoute.endTime || selectedRoute.scheduledWindowEnd || selectedRoute.readableEndTime) && (
                      <div style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)', marginBottom: '0.25rem' }}>
                        <strong>End Time:</strong> {
                          selectedRoute.readableEndTime ||
                          toDateMaybe(selectedRoute.endTime || selectedRoute.scheduledWindowEnd)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) ||
                          'Not set'
                        }
                      </div>
                    )}
                  </div>
                  <span style={{ 
                    backgroundColor: statusPillColor(selectedRoute.status), 
                    color: 'white', 
                    padding: 'clamp(0.3rem, 1.5vw, 0.35rem) clamp(0.6rem, 2vw, 0.75rem)', 
                    borderRadius: '999px', 
                    fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', 
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedRoute.status || 'Unknown'}
                  </span>
                </div>

                {selectedRoute.pickups && Array.isArray(selectedRoute.pickups) && selectedRoute.pickups.length > 0 && (
                  <div style={{ marginTop: 'clamp(1rem, 3vw, 1.5rem)', padding: 'clamp(0.75rem, 2.5vw, 1rem)', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'clamp(6px, 1.5vw, 8px)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--secondary-color)', marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.95rem, 2.5vw, 1rem)' }}>
                      Pickups ({selectedRoute.pickups.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 2vw, 0.75rem)' }}>
                      {selectedRoute.pickups.map((pickup, idx) => {
                        const pickupId = typeof pickup === 'string' ? pickup : pickup.pickupId
                        const customerName = pickup.customerName || 'Unknown Customer'
                        const address = pickup.address || 'No address'
                        
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                              backgroundColor: 'white',
                              borderRadius: 'clamp(4px, 1.5vw, 6px)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'start',
                              gap: '0.5rem'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontWeight: 600, 
                                color: 'var(--secondary-color)',
                                marginBottom: '0.25rem',
                                fontSize: 'clamp(0.85rem, 2.2vw, 0.95rem)'
                              }}>
                                {customerName}
                              </div>
                              <div style={{ 
                                fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', 
                                color: 'var(--accent-color)',
                                wordBreak: 'break-word'
                              }}>
                                📍 {address}
                              </div>
                            </div>
                            <button
                              onClick={() => openReassignModal(pickup)}
                              style={{
                                padding: 'clamp(0.35rem, 1.5vw, 0.4rem) clamp(0.6rem, 2vw, 0.75rem)',
                                backgroundColor: 'var(--secondary-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'clamp(4px, 1vw, 6px)',
                                cursor: 'pointer',
                                fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                transition: 'opacity 0.2s',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                              onMouseLeave={(e) => e.target.style.opacity = '1'}
                            >
                              Reassign
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Change Driver Button */}
                <div style={{ marginTop: 'clamp(1rem, 3vw, 1.5rem)', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={openDriverModal}
                    style={{
                      padding: 'clamp(0.6rem, 2vw, 0.75rem) clamp(1.25rem, 4vw, 1.5rem)',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'clamp(6px, 1.5vw, 8px)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      transition: 'opacity 0.2s',
                      width: window.innerWidth < 640 ? '100%' : 'auto'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    Change Driver
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Selection Modal */}
      {showDriverModal && (
        <div onClick={closeDriverModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(500px, 100%)', maxHeight: '80vh', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--secondary-color)' }}>Select Driver</div>
              <button onClick={closeDriverModal} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--secondary-color)' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
              {loadingDrivers && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-color)' }}>
                  Loading drivers...
                </div>
              )}
              {!loadingDrivers && drivers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-color)' }}>
                  No drivers found
                </div>
              )}
              {!loadingDrivers && drivers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {drivers.map(driver => (
                    <button
                      key={driver.id}
                      onClick={() => changeDriver(driver.id, driver.name)}
                      disabled={updatingDriver || driver.id === selectedRoute?.driverId}
                      style={{
                        padding: '1rem',
                        backgroundColor: driver.id === selectedRoute?.driverId ? 'rgba(0,0,0,0.05)' : 'white',
                        border: driver.id === selectedRoute?.driverId ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: driver.id === selectedRoute?.driverId ? 'default' : 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                        opacity: updatingDriver ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (driver.id !== selectedRoute?.driverId && !updatingDriver) {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 191, 179, 0.05)'
                          e.currentTarget.style.borderColor = 'var(--primary-color)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (driver.id !== selectedRoute?.driverId) {
                          e.currentTarget.style.backgroundColor = 'white'
                          e.currentTarget.style.borderColor = 'var(--border-color)'
                        }
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--secondary-color)', marginBottom: '0.25rem' }}>
                          {driver.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                          {driver.email || 'No email'}
                        </div>
                      </div>
                      {driver.id === selectedRoute?.driverId && (
                        <span style={{ 
                          color: 'var(--primary-color)', 
                          fontWeight: 600,
                          fontSize: '0.9rem'
                        }}>
                          Current
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {updatingDriver && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  backgroundColor: 'rgba(255,255,255,0.9)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: '10px'
                }}>
                  <div style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>
                    Updating driver...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign Pickup Modal */}
      {showReassignModal && selectedPickup && (
        <div onClick={closeReassignModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003, padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: 'min(500px, 100%)', maxHeight: '80vh', borderRadius: 'clamp(8px, 2vw, 10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(0.75rem, 2.5vw, 1rem)', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: 'var(--secondary-color)' }}>Reassign Pickup</div>
                <div style={{ fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: 'var(--accent-color)', marginTop: '0.25rem' }}>
                  {selectedPickup.customerName || 'Unknown Customer'}
                </div>
              </div>
              <button onClick={closeReassignModal} style={{ background: 'transparent', border: 'none', fontSize: 'clamp(1.3rem, 4vw, 1.5rem)', cursor: 'pointer', color: 'var(--secondary-color)', padding: '0.25rem', minWidth: '32px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', overflow: 'auto', flex: 1 }}>
              {availableRoutes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-color)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚫</div>
                  <div style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', fontWeight: 600 }}>No other routes available on this day</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 2vw, 0.75rem)' }}>
                  <div style={{ fontSize: 'clamp(0.85rem, 2.2vw, 0.9rem)', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                    Select a route to reassign this pickup to:
                  </div>
                  {availableRoutes.map(route => {
                    const startTime = toDateMaybe(route.scheduledTime || route.scheduledAt || route.scheduledWindowStart)
                    const endTime = toDateMaybe(route.endTime || route.scheduledWindowEnd)
                    
                    return (
                      <button
                        key={route.id}
                        onClick={() => reassignPickup(route.id)}
                        disabled={reassigning}
                        style={{
                          padding: 'clamp(0.75rem, 2.5vw, 1rem)',
                          backgroundColor: 'white',
                          border: '2px solid var(--border-color)',
                          borderRadius: 'clamp(6px, 1.5vw, 8px)',
                          cursor: reassigning ? 'default' : 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          opacity: reassigning ? 0.5 : 1,
                          display: 'flex',
                          gap: 'clamp(0.5rem, 2vw, 1rem)',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                          if (!reassigning && window.innerWidth >= 768) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 191, 179, 0.05)'
                            e.currentTarget.style.borderColor = 'var(--primary-color)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!reassigning) {
                            e.currentTarget.style.backgroundColor = 'white'
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                          }
                        }}
                      >
                        {/* Time */}
                        {startTime && (
                          <div style={{ 
                            minWidth: window.innerWidth < 640 ? 'auto' : '80px',
                            padding: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                            backgroundColor: 'rgba(0, 191, 179, 0.08)',
                            borderRadius: 'clamp(4px, 1vw, 6px)',
                            textAlign: 'center',
                            flexShrink: 0
                          }}>
                            <div style={{ 
                              fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', 
                              fontWeight: 700, 
                              color: 'var(--primary-color)'
                            }}>
                              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            {endTime && (
                              <div style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.75rem)', color: 'var(--accent-color)' }}>
                                - {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Driver info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--secondary-color)', fontSize: 'clamp(0.9rem, 2.2vw, 1rem)', marginBottom: '0.25rem' }}>
                            {route.driver}
                          </div>
                          <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--accent-color)' }}>
                            {route.pickups?.length || 0} {route.pickups?.length === 1 ? 'pickup' : 'pickups'}
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        {window.innerWidth >= 640 && (
                          <div style={{ color: 'var(--primary-color)', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', fontWeight: 700 }}>
                            →
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {reassigning && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  backgroundColor: 'rgba(255,255,255,0.9)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: 'clamp(8px, 2vw, 10px)'
                }}>
                  <div style={{ color: 'var(--secondary-color)', fontWeight: 600, fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                    Reassigning pickup...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      {showSuccessModal && (
        <div 
          onClick={() => setShowSuccessModal(false)} 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1004, 
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-in'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              backgroundColor: 'white', 
              width: 'min(400px, 90%)', 
              borderRadius: '12px', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)', 
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              {/* Success Icon */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: successMessage.includes('Failed') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}>
                {successMessage.includes('Failed') ? '❌' : '✓'}
              </div>
              
              {/* Message */}
              <div style={{ 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--secondary-color)',
                lineHeight: '1.5'
              }}>
                {successMessage}
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem 2rem',
                  backgroundColor: successMessage.includes('Failed') ? '#dc2626' : 'var(--primary-color)',
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
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default RouteCalendar

