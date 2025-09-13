import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
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

function formatPickupAddressObject(address) {
  if (!address || typeof address !== 'object') return ''
  const line1 = address.street || ''
  const cityState = [address.city, address.state].filter(Boolean).join(', ')
  const parts = [line1, cityState, address.zip].filter(Boolean)
  return parts.join(' • ')
}

function formatDateTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusPillColor(status) {
  const s = (status || '').toString().toLowerCase()
  if (['returned', 'complete', 'completed', 'done'].includes(s)) return '#16a34a'
  if (['processing', 'active', 'in_progress', 'in-progress', 'ongoing', 'received'].includes(s)) return '#0284c7'
  if (['pending', 'scheduled', 'queued'].includes(s)) return '#a16207'
  if (['cancelled', 'canceled', 'failed'].includes(s)) return '#dc2626'
  return '#475569'
}

function Returns() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('all') // all | pending | processing | returned
  const [term, setTerm] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAllItems() {
      setLoading(true)
      setError('')
      try {
        const pickupsSnap = await getDocs(collection(db, 'pickups'))
        if (cancelled) return
        const pickups = pickupsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const itemsArrays = await Promise.all(pickups.map(async (p) => {
          try {
            const itemsSnap = await getDocs(collection(db, 'pickups', p.id, 'items'))
            const itemsForPickup = itemsSnap.docs.map(i => ({
              id: i.id,
              pickupId: p.id,
              pickupAddress: (typeof p.address === 'string' ? p.address : undefined) || formatPickupAddressObject(p.pickupAddress),
              pickupReference: p.reference,
              pickupCustomerName: p.customerName,
              pickupScheduledAt: toDateMaybe(p.scheduledTime || p.scheduledTimeLocal || p.scheduledAt || p.date || p.scheduledDate),
              ...i.data(),
            }))
            return itemsForPickup
          } catch {
            return []
          }
        }))

        const flattened = itemsArrays.flat()
        const embedded = pickups.flatMap(p => Array.isArray(p.items) ? p.items.map(i => ({
          id: i.id || i.itemId || `${p.id}-${Math.random().toString(36).slice(2,8)}`,
          pickupId: p.id,
          pickupAddress: (typeof p.address === 'string' ? p.address : undefined) || formatPickupAddressObject(p.pickupAddress),
          pickupReference: p.reference,
          pickupCustomerName: p.customerName,
          pickupScheduledAt: toDateMaybe(p.scheduledTime || p.scheduledTimeLocal || p.scheduledAt || p.date || p.scheduledDate),
          ...i,
        })) : [])
        const all = [...flattened, ...embedded]
        setItems(all)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load items')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAllItems()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase()
    return items.filter(item => {
      const itemStatus = (item.status || 'pending').toString().toLowerCase()
      if (statusFilter !== 'all' && itemStatus !== statusFilter) return false
      if (!t) return true
      const hay = [
        item.name,
        item.description,
        item.pickupAddress,
        item.pickupReference,
        item.pickupCustomerName,
        item.size,
        item.notes,
      ].filter(Boolean).map(v => v.toString().toLowerCase()).join(' ')
      return hay.includes(t)
    })
  }, [items, statusFilter, term])

  async function updateItemStatus(item, nextStatus) {
    try {
      await updateDoc(doc(db, 'pickups', item.pickupId, 'items', item.id), {
        status: nextStatus,
        processedAt: nextStatus === 'processing' ? serverTimestamp() : undefined,
        returnedAt: nextStatus === 'returned' ? serverTimestamp() : undefined,
      })
      setItems(prev => prev.map(it => it.id === item.id && it.pickupId === item.pickupId ? { ...it, status: nextStatus } : it))
    } catch (err) {
      alert(err?.message || 'Failed to update status')
    }
  }

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Returns</h1>
        <p style={{ color: 'var(--accent-color)' }}>Manage and process all pickup items</p>
      </section>

      <section style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search items, address, customer…"
            style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', minWidth: '260px', flex: '1 1 300px' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="returned">Returned</option>
          </select>
          <div style={{ marginLeft: 'auto', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
            {filtered.length} of {items.length} items
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {loading && <p style={{ color: 'var(--accent-color)' }}>Loading items…</p>}
          {error && <p style={{ color: 'salmon' }}>{error}</p>}
          {!loading && !error && (
            filtered.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map(item => {
                  const scheduled = toDateMaybe(item.pickupScheduledAt)
                  const status = (item.status || 'pending').toString()
                  return (
                    <li key={`${item.pickupId}_${item.id}`} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', backgroundColor: 'rgba(0,0,0,0.02)', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {(item.photo?.url || item.driverPhoto?.url) && (
                            <img src={item.photo?.url || item.driverPhoto?.url} alt="Item" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--secondary-color)' }}>{item.name || item.description || `Item ${item.id}`}</div>
                            <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                              {(item.quantity ? `Qty ${item.quantity}` : '')}{item.size ? ` • ${item.size}` : ''}{item.notes ? ` • ${item.notes}` : ''}
                            </div>
                          </div>
                        </div>
                        <span style={{ backgroundColor: statusPillColor(status), color: 'white', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>{status}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', padding: '0.75rem 1rem', alignItems: 'center' }}>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                          <div>{item.pickupCustomerName || '—'}{item.pickupReference ? ` • ${item.pickupReference}` : ''}</div>
                          <div>{item.pickupAddress || '—'}{scheduled ? ` • ${formatDateTime(scheduled)}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button onClick={() => updateItemStatus(item, 'pending')} style={{ padding: '0.4rem 0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Set Pending</button>
                          <button onClick={() => updateItemStatus(item, 'processing')} style={{ padding: '0.4rem 0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Mark Processing</button>
                          <button onClick={() => updateItemStatus(item, 'returned')} style={{ padding: '0.45rem 0.75rem', border: 'none', borderRadius: '6px', background: 'var(--primary-color)', color: 'white', cursor: 'pointer' }}>Mark Returned</button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p style={{ color: 'var(--accent-color)' }}>No items match your filters.</p>
            )
          )}
        </div>
      </section>
    </main>
  )
}

export default Returns


