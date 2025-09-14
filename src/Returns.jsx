import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function toDateMaybe(value) {
  if (!value) {
    console.log('[toDateMaybe] Received falsy value:', value)
    return null
  }
  if (value?.toDate) {
    try { 
      const d = value.toDate()
      console.log('[toDateMaybe] Converted Firestore Timestamp to Date:', d)
      return d
    } catch (err) { 
      console.error('[toDateMaybe] Error converting Firestore Timestamp:', err)
    }
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    console.log('[toDateMaybe] Converted number to Date:', value, d)
    return d
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    if (isNaN(d.getTime())) {
      console.warn('[toDateMaybe] Invalid date string:', value)
      return null
    }
    console.log('[toDateMaybe] Converted string to Date:', value, d)
    return d
  }
  console.warn('[toDateMaybe] Could not convert value to Date:', value)
  return null
}

function formatPickupAddressObject(address) {
  if (!address || typeof address !== 'object') {
    console.warn('[formatPickupAddressObject] Invalid address object:', address)
    return ''
  }
  const line1 = address.street || ''
  const cityState = [address.city, address.state].filter(Boolean).join(', ')
  const parts = [line1, cityState, address.zip].filter(Boolean)
  const formatted = parts.join(' • ')
  console.log('[formatPickupAddressObject] Formatted address:', formatted)
  return formatted
}

function formatDateTime(date) {
  if (!date) {
    console.log('[formatDateTime] No date provided')
    return '—'
  }
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  console.log('[formatDateTime] Formatted date:', date, formatted)
  return formatted
}

function statusPillColor(status) {
  const s = (status || '').toString().toLowerCase()
  let color = '#475569'
  if (['returned', 'complete', 'completed', 'done'].includes(s)) color = '#16a34a'
  else if (['processing', 'active', 'in_progress', 'in-progress', 'ongoing', 'received'].includes(s)) color = '#0284c7'
  else if (['pending', 'scheduled', 'queued'].includes(s)) color = '#a16207'
  else if (['cancelled', 'canceled', 'failed'].includes(s)) color = '#dc2626'
  console.log('[statusPillColor] Status:', status, 'Color:', color)
  return color
}

function Returns() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('all') // all | hauled_off | scanned
  const [selectedItem, setSelectedItem] = useState(null)
  const [term, setTerm] = useState('')
  
  // Add confirmation state
  const [confirmationItem, setConfirmationItem] = useState(null)
  const [confirmationAction, setConfirmationAction] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadReturnsItems() {
      setLoading(true)
      setError('')
      console.log('[loadReturnsItems] Loading returns items...')
      
      try {
        // Get all pickups and all items in parallel
        const [pickupsSnap, itemsSnap] = await Promise.all([
          getDocs(collection(db, 'pickups')),
          getDocs(collection(db, 'items'))
        ])
        
        if (cancelled) return
        
        const pickups = pickupsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        console.log('[loadReturnsItems] Loaded pickups:', pickups.length)
        console.log('[loadReturnsItems] Loaded items:', allItems.length)

        // Create items lookup map for efficient access
        const itemsMap = Object.fromEntries(allItems.map(item => [item.id, item]))
        
        // Get all items from pickup items arrays
        const returnsItems = []
        
        for (const pickup of pickups) {
          if (cancelled) return
          
          // Check if pickup has items array
          if (!pickup.items || !Array.isArray(pickup.items)) {
            console.log('[loadReturnsItems] Pickup has no items array:', pickup.id)
            continue
          }
          
          console.log('[loadReturnsItems] Processing pickup items:', pickup.id, pickup.items.length)
          
          for (const itemRef of pickup.items) {
            // Handle both string IDs and objects with itemId property
            const itemId = typeof itemRef === 'string' ? itemRef : itemRef.itemId || itemRef.id
            
            if (!itemId) {
              console.warn('[loadReturnsItems] Invalid item reference:', itemRef)
              continue
            }
            
            const item = itemsMap[itemId]
            if (!item) {
              console.warn('[loadReturnsItems] Item not found:', itemId)
              continue
            }
            
            // Check if item has the required status
            const status = (item.status || '').toString()
            if (status !== 'Hauled Off' && status !== 'Scanned') {
              continue
            }
            
            // Add pickup context to the item
            const itemWithContext = {
              ...item,
              pickupId: pickup.id,
              pickupAddress: formatPickupAddressObject(pickup.address || pickup.pickupAddress),
              pickupReference: pickup.reference,
              pickupCustomerName: pickup.customerName,
              pickupScheduledAt: toDateMaybe(pickup.scheduledTime || pickup.scheduledTimeLocal || pickup.scheduledAt || pickup.date || pickup.scheduledDate),
            }
            
            returnsItems.push(itemWithContext)
          }
        }

        console.log('[loadReturnsItems] Total returns items loaded:', returnsItems.length)
        if (returnsItems.length > 0) {
          console.log('[loadReturnsItems] Sample returns item:', returnsItems[0])
        }
        
        setItems(returnsItems)
      } catch (err) {
        console.error('[loadReturnsItems] Error:', err)
        if (!cancelled) setError(err?.message || 'Failed to load returns items')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadReturnsItems()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!items || !Array.isArray(items)) {
      console.log('[filtered] Items not ready:', items)
      return []
    }
    const t = term.trim().toLowerCase()
    console.log('[filtered] Filtering items with term:', t, 'and statusFilter:', statusFilter)
    return items.filter(item => {
      const itemStatus = (item.status || '').toString()
      
      // Apply status filter (items are already pre-filtered to "Hauled Off" and "Scanned")
      if (statusFilter === 'Hauled Off') {
        if (itemStatus !== 'Hauled Off') return false
      } else if (statusFilter === 'Scanned') {
        if (itemStatus !== 'Scanned') return false
      }
      // If statusFilter is 'all', show all items (which are already "Hauled Off" or "Scanned")
      
      // Apply search term
      if (!t) return true
      const hay = [
        item.name,
        item.itemDescription,
        item.description,
        item.pickupAddress,
        item.pickupReference,
        item.itemSize,
        item.size,
        item.notes,
      ].filter(Boolean).map(v => v.toString().toLowerCase()).join(' ')
      return hay.includes(t)
    })
  }, [items, statusFilter, term])

  async function updateItemStatus(item, nextStatus) {
    try {
      // Update the item in the main items collection
      await updateDoc(doc(db, 'items', item.id), {
        status: nextStatus,
        processedAt: nextStatus === 'processing' ? serverTimestamp() : undefined,
        returnedAt: nextStatus === 'returned' ? serverTimestamp() : undefined,
      })
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: nextStatus } : it))
      setConfirmationItem(null)
      setConfirmationAction('')
    } catch (err) {
      alert(err?.message || 'Failed to update status')
    }
  }

  async function processReturn(item) {
    try {
      // Update the item in the main items collection
      await updateDoc(doc(db, 'items', item.id), {
        status: 'returned',
        returnedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
      })
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'returned' } : it))
      setSelectedItem(null)
      setConfirmationItem(null)
      setConfirmationAction('')
    } catch (err) {
      alert(err?.message || 'Failed to process return')
    }
  }

  function handleButtonClick(item, action) {
    setConfirmationItem(item)
    setConfirmationAction(action)
  }

  async function handleConfirmation() {
    try {
      // Map the action to the correct status for the function
      const scanStatus = confirmationAction === 'could_not_be_scanned' ? 'Could not be scanned' : 'Scanned'
      
      // Call the scan_in_item Firebase function
      const response = await fetch('https://us-central1-haulzy-dev.cloudfunctions.net/scan_in_item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: confirmationItem.id,
          status: scanStatus
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('scan_in_item result:', result)

      // Update local state with the actual status that was sent to the function
      setItems(prev => prev.map(it => it.id === confirmationItem.id ? { ...it, status: scanStatus } : it))

      // Close modals
      setSelectedItem(null)
      setConfirmationItem(null)
      setConfirmationAction('')
    } catch (err) {
      console.error('Error calling scan_in_item:', err)
      alert(err?.message || 'Failed to process item')
    }
  }

  function handleCancelConfirmation() {
    setConfirmationItem(null)
    setConfirmationAction('')
  }

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'black', marginBottom: '0.5rem' }}>Returns</h1>
        <p style={{ color: 'black' }}>Manage and process all pickup items</p>
      </section>

      <section style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
        <div className="returns-search-form" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search items, address, customer…"
            style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', minWidth: '200px', flex: '1 1 300px', fontSize: '1rem', minHeight: '44px' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.75rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', minHeight: '44px', minWidth: '140px' }}>
            <option value="all">All</option>
            <option value="hauled_off">Hauled Off</option>
            <option value="scanned">Scanned</option>
          </select>
          <div style={{ color: 'black', fontSize: '0.9rem', display: 'flex', alignItems: 'center', minHeight: '44px', flex: '1 1 100%', justifyContent: 'center' }}>
            {filtered?.length || 0} of {items?.length || 0} items
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {loading && <p style={{ color: 'black' }}>Loading items…</p>}
          {error && <p style={{ color: 'salmon' }}>{error}</p>}
          {!loading && !error && (
            filtered && filtered.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map(item => {
                  const scheduled = toDateMaybe(item.pickupScheduledAt)
                  const status = (item.status || 'pending').toString()
                  return (
                    <li key={`${item.pickupId}_${item.id}`} className="returns-item-card" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelectedItem(item)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', backgroundColor: 'rgba(0,0,0,0.02)', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Photo Only - Bigger */}
                          {(item.photo?.url || item.image?.url) && (
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <img 
                                src={item.photo?.url || item.image?.url} 
                                alt="Item" 
                                style={{ 
                                  width: '80px', 
                                  height: '80px', 
                                  objectFit: 'cover', 
                                  borderRadius: '8px', 
                                  border: '1px solid var(--border-color)' 
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'black' }}>{item.name || item.itemDescription}</div>
                            {(item.itemDescription || item.description) && (
                              <div style={{ color: 'black', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                <strong>Description:</strong> {item.itemDescription || item.description}
                              </div>
                            )}
                            <div style={{ color: 'black', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <div style={{ 
                            color: 'black', 
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
                        <span style={{ backgroundColor: statusPillColor(status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{status}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.75rem 1rem' }}>
                        <div style={{ color: 'black', fontSize: '0.9rem' }}>
                          <div>{item.pickupCustomerName || '—'}{item.pickupReference ? ` • ${item.pickupReference}` : ''}</div>
                          <div>{item.pickupAddress || '—'}{scheduled ? ` • ${formatDateTime(scheduled)}` : ''}</div>
                        </div>
                        <div className="returns-item-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                          <button onClick={() => handleButtonClick(item, 'could_not_be_scanned')} style={{ padding: '0.6rem 1rem', border: 'none', borderRadius: '6px', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}>Could Not Be Scanned</button>
                          <button onClick={() => handleButtonClick(item, 'returned')} style={{ padding: '0.6rem 1rem', border: 'none', borderRadius: '6px', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}>Mark Returned</button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p style={{ color: 'black' }}>No items match your filters.</p>
            )
          )}
        </div>
      </section>

      {/* Process Return Modal */}
      {selectedItem && (
        <div style={{
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
        }} onClick={() => setSelectedItem(null)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'black', marginBottom: '1rem', fontSize: '1.5rem' }}>
              Process Return
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'black' }}>
                {selectedItem.name || selectedItem.itemDescription}
              </div>
              {(selectedItem.itemDescription || selectedItem.description) && (
                <div style={{ color: 'black', marginBottom: '0.5rem' }}>
                  <strong>Description:</strong> {selectedItem.itemDescription || selectedItem.description}
                </div>
              )}
              
              {/* Photo Only in Modal - Bigger */}
              {(selectedItem.photo?.url || selectedItem.image?.url) && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'black' }}>Photo:</div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={selectedItem.photo?.url || selectedItem.image?.url} 
                        alt="Item" 
                        style={{ 
                          width: '120px', 
                          height: '120px', 
                          objectFit: 'cover', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border-color)' 
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{ color: 'black', fontSize: '0.9rem' }}>
                <div>Customer: {selectedItem.pickupCustomerName || '—'}</div>
                <div>Pickup: {selectedItem.pickupReference || '—'}</div>
                <div>Address: {selectedItem.pickupAddress || '—'}</div>
                {selectedItem.itemSize && <div>Size: {selectedItem.itemSize} cubic ft</div>}
                {selectedItem.quantity && <div>Quantity: {selectedItem.quantity}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'white',
                  color: 'black',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  minHeight: '44px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleButtonClick(selectedItem, 'could_not_be_scanned')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  minHeight: '44px',
                  fontWeight: '600'
                }}
              >
                Could Not Be Scanned
              </button>
              <button
                onClick={() => handleButtonClick(selectedItem, 'returned')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  minHeight: '44px',
                  fontWeight: '600'
                }}
              >
                Mark Returned
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '1rem'
        }} onClick={handleCancelConfirmation}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'black', marginBottom: '1rem', fontSize: '1.5rem' }}>
              Confirm Action
            </h2>
            
            <p style={{ color: 'black', marginBottom: '1.5rem', fontSize: '1rem' }}>
              Are you sure you want to submit "{confirmationAction === 'could_not_be_scanned' ? 'Could Not Be Scanned' : 'Mark Returned'}"?
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelConfirmation}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'white',
                  color: 'black',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  minHeight: '44px'
                }}
              >
                No
              </button>
              <button
                onClick={handleConfirmation}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: confirmationAction === 'could_not_be_scanned' ? '#dc2626' : 'var(--primary-color)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  minHeight: '44px',
                  fontWeight: '600'
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Returns


