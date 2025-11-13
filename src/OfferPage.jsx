import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from './firebase'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

/**
 * OfferPage – high-converting, two‑step lead → schedule flow
 * Improvements vs original:
 * - Step 1 creates a "lead" immediately (so you own the email even if they bounce)
 * - Step 2 upgrades the lead to a scheduled request (status change + details)
 * - Better validation + accessibility (aria-invalid, inputMode, autoFocus, keyboard hints)
 * - Loading/disabled states to prevent double submits
 * - Honeypot field to reduce bot spam
 * - URL attribution capture (utm_*, fbclid, referrer)
 * - Time-slot generator with correct AM/PM, local TZ and closed hours control
 * - Zip allowlist check with graceful fallback (collect lead even if out of area)
 * - Centralized env config + fetch with timeout
 */

const SERVICE_ZIPS = [
  // Utah Valley core (tweak this list anytime)
  '84663', // Springville
  '84660', // Spanish Fork
  '84601', '84604', '84606', // Provo
  '84057', '84058', '84097', // Orem
  '84664', // Mapleton
  '84062', // Pleasant Grove
  '84003', // American Fork
]

const HOURS = { start: 8, end: 20 } // 8am → 8pm last start
const CF_BASE = import.meta.env.VITE_FIREBASE_URL

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function OfferPage() {
  const navigate = useNavigate()
  const query = useQuery()

  const [step, setStep] = useState(1)
  const [leadId, setLeadId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const emailRef = useRef(null)

  const [formData, setFormData] = useState({
    email: '',
    zipCode: '',
    phone: '',
    address: '',
    numberOfItems: '',
    day: '',
    time: '',
    // internal
    honey: '', // honeypot – should remain empty
  })

  // Focus first field on mount / step change
  useEffect(() => {
    emailRef.current?.focus()
    window.scrollTo({ top: 0 })
  }, [step])

  // ---- Helpers
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const isValidZip = (v) => /^\d{5}$/.test(v)
  const isValidPhone10 = (v) => (v || '').replace(/\D/g, '').length === 10
  const isServiceZip = (v) => SERVICE_ZIPS.includes(v)

  const genDays = () => {
    const out = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const value = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      out.push({ value, label })
    }
    return out
  }

  const to12h = (h) => {
    const hour = ((h + 11) % 12) + 1
    const ampm = h < 12 ? 'AM' : 'PM'
    return `${hour}:00 ${ampm}`
  }

  const genSlots = () => {
    const slots = []
    for (let h = HOURS.start; h < HOURS.end; h++) {
      slots.push({ value: `${h}:00-${h + 1}:00`, label: `${to12h(h)} – ${to12h(h + 1)}` })
    }
    return slots
  }

  const days = useMemo(genDays, [])
  const timeSlots = useMemo(genSlots, [])

  // UTM + attribution capture
  const attribution = useMemo(() => {
    const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid']
    const a = {}
    keys.forEach((k) => {
      const v = query.get(k)
      if (v) a[k] = v
    })
    a.referrer = document.referrer || 'direct'
    return a
  }, [query])

  // ---- Step 1 submit (create lead)
  const onStep1 = async (e) => {
    e.preventDefault()
    if (submitting) return

    const e1 = {}
    if (!formData.email) e1.email = 'Email is required'
    else if (!isValidEmail(formData.email)) e1.email = 'Enter a valid email'

    if (!formData.zipCode) e1.zipCode = 'ZIP code is required'
    else if (!isValidZip(formData.zipCode)) e1.zipCode = 'Enter a 5‑digit ZIP'

    // honeypot
    if (formData.honey) e1.email = 'Invalid'

    if (Object.keys(e1).length) { setErrors(e1); return }

    setSubmitting(true)
    setErrors({})

    try {
      const payload = {
        email: formData.email,
        zipCode: formData.zipCode,
        status: isServiceZip(formData.zipCode) ? 'lead' : 'waitlist',
        attribution,
        createdAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, 'free_pickups'), payload)
      setLeadId(docRef.id)

      // Send notification for lead capture
      const notificationBody = `
Email: ${formData.email}
ZIP Code: ${formData.zipCode}
Status: ${isServiceZip(formData.zipCode) ? 'In Service Area' : 'Waitlist'}
      `.trim()

      // Fire-and-forget notification (3s timeout)
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 3000)
      try {
        await fetch(`${CF_BASE}/send_custom_notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: ['mlxfqFPf9uh92KokuTFVmkgp9Rg1'],
            title: 'New Lead Captured',
            body: notificationBody,
            data: {
              type: 'free_pickup_lead',
              leadId: docRef.id,
              email: formData.email,
              zipCode: formData.zipCode,
              status: payload.status,
            },
          }),
          signal: controller.signal,
        })
      } catch (_) {
        console.log('Notification failed (non-blocking)')
      } finally {
        clearTimeout(t)
      }

      setStep(2)
    } catch (err) {
      console.error('Failed to create lead', err)
      setErrors({ email: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Step 2 submit (upgrade lead → scheduled request)
  const onStep2 = async (e) => {
    e.preventDefault()
    if (submitting) return

    const e2 = {}
    if (formData.phone && !isValidPhone10(formData.phone)) e2.phone = 'Use a 10‑digit phone'
    if (!formData.address) e2.address = 'Address is required'
    if (!formData.numberOfItems) e2.numberOfItems = 'How many packages?'
    if (!formData.day) e2.day = 'Select a day'
    if (!formData.time) e2.time = 'Select a time'
    if (Object.keys(e2).length) { setErrors(e2); return }

    setSubmitting(true)

    // Update Firestore only (no notification)
    try {
      if (!leadId) {
        // Fallback: create if somehow missing
        const ref = await addDoc(collection(db, 'free_pickups'), {
          email: formData.email,
          zipCode: formData.zipCode,
          createdAt: serverTimestamp(),
          status: 'lead',
          attribution,
        })
        setLeadId(ref.id)
      }

      await updateDoc(doc(db, 'free_pickups', leadId), {
        phone: formData.phone || null,
        address: formData.address,
        numberOfItems: Number(formData.numberOfItems),
        day: formData.day,
        time: formData.time,
        status: 'pending',
        upgradedAt: serverTimestamp(),
      })

      setShow(true)
      // Reset step 1 for next visitor
      setStep(1)
      setLeadId(null)
      setFormData({ email: '', zipCode: '', phone: '', address: '', numberOfItems: '', day: '', time: '', honey: '' })
    } catch (err) {
      console.error('Failed to upgrade lead', err)
      setErrors({ address: 'Saving failed. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const [show, setShow] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setFormData((s) => ({ ...s, [name]: value }))
    if (errors[name]) setErrors((s) => ({ ...s, [name]: null }))
  }

  return (
    <>
      {show && (
        <div className="modal-mask" onClick={() => setShow(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <h2>You're All Set!</h2>
            <p>We'll confirm your free pickup by email (and text if provided).</p>
            <div className="modal-actions">
              <button className="cta-button" onClick={() => setShow(false)}>Got it!</button>
              <button className="cta-secondary" onClick={() => { setShow(false); navigate('/') }}>Learn More</button>
            </div>
          </div>
        </div>
      )}

      <section className="hero-section">
        {step === 1 && (
          <div className="step step-1">
            <header className="hero-copy">
              <h1>Never wait in a returns line again</h1>
              <p>Get your first pickup <strong className="accent">completely FREE</strong>. We pick up your returns right from your doorstep.</p>
            </header>

            <form onSubmit={onStep1} className="card">
              <div className="field">
                <label>Email <span className="req">*</span></label>
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={onChange}
                  placeholder="you@email.com"
                  inputMode="email"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <small className="error">{errors.email}</small>}
              </div>

              <div className="field">
                <label>ZIP code <span className="req">*</span></label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={onChange}
                  placeholder="12345"
                  inputMode="numeric"
                  maxLength={5}
                  aria-invalid={!!errors.zipCode}
                />
                {errors.zipCode && <small className="error">{errors.zipCode}</small>}
                {!!formData.zipCode && !errors.zipCode && !isServiceZip(formData.zipCode) && (
                  <small className="note">Outside our current area — we'll notify you as we expand.</small>
                )}
              </div>

              {/* Honeypot */}
              <input type="text" name="honey" value={formData.honey} onChange={onChange} className="hp" tabIndex="-1" autoComplete="off" />

              <button type="submit" className="cta-button" disabled={submitting}>
                {submitting ? 'Saving…' : 'Claim My Free Pickup →'}
              </button>
              <p className="muted">No credit card required • Takes 30 seconds</p>
            </form>

            <div className="benefits">
              <div className="benefit"><div className="emoji">🏠</div><h3>Doorstep Pickup</h3><p>No post office trips. We come to you.</p></div>
              <div className="benefit"><div className="emoji">⚡</div><h3>Fast & Easy</h3><p>Schedule in seconds. We handle the rest.</p></div>
              <div className="benefit"><div className="emoji">💰</div><h3>First One's Free</h3><p>Try it risk‑free. Your first pickup is on us.</p></div>
            </div>

            <div className="center">
              <button className="cta-secondary" onClick={() => navigate('/')}>Learn More About Haulzy</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step step-2">
            <header className="hero-copy small">
              <div className="emoji big">🎉</div>
              <h1>You're Eligible!</h1>
              <p>Now let's schedule your free pickup.</p>
            </header>

            <form onSubmit={onStep2} className="card">
              <div className="field">
                <label>Phone (optional)</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={onChange}
                  placeholder="(555) 123‑4567"
                  inputMode="tel"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <small className="error">{errors.phone}</small>}
              </div>

              <div className="field">
                <label>Pickup Address <span className="req">*</span></label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={onChange}
                  placeholder="123 Main St, City, ST 12345"
                  aria-invalid={!!errors.address}
                />
                {errors.address && <small className="error">{errors.address}</small>}
              </div>

              <div className="field">
                <label>Number of Items <span className="req">*</span></label>
                <input
                  type="number"
                  name="numberOfItems"
                  value={formData.numberOfItems}
                  onChange={onChange}
                  min={1}
                  placeholder="e.g., 3"
                  aria-invalid={!!errors.numberOfItems}
                />
                {errors.numberOfItems && <small className="error">{errors.numberOfItems}</small>}
              </div>

              <div className="field">
                <label>Preferred Pickup Day <span className="req">*</span></label>
                <select name="day" value={formData.day} onChange={onChange} aria-invalid={!!errors.day}>
                  <option value="">Select a day</option>
                  {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {errors.day && <small className="error">{errors.day}</small>}
              </div>

              <div className="field">
                <label>Preferred Pickup Time <span className="req">*</span></label>
                <select name="time" value={formData.time} onChange={onChange} aria-invalid={!!errors.time}>
                  <option value="">Select a time</option>
                  {timeSlots.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {errors.time && <small className="error">{errors.time}</small>}
              </div>

              <button type="submit" className="cta-button" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Confirm My Free Pickup'}
              </button>
              <p className="muted i">We'll confirm with you via email before we come.</p>
            </form>

            <button className="link" onClick={() => setStep(1)}>← Back to previous step</button>
          </div>
        )}
      </section>

       {/* quick styles scoped for this component */}
       <style>{`
         .hero-section{max-width:1200px;margin:2rem auto;padding:2rem;position:relative}
         .accent{color:var(--primary-color)}
         .card{background:var(--card-background,#fff);padding:2.5rem;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.2);max-width:560px;margin:0 auto;width:100%;color:var(--text-color,#333)}
         .hero-copy{max-width:800px;margin:0 auto 2rem;text-align:center;padding:0 1rem;color:inherit}
         .hero-copy h1{font-size:clamp(2rem,7vw,3.5rem);line-height:1.1;margin:0 0 1rem;color:inherit}
         .hero-copy p{font-size:clamp(1rem,3vw,1.25rem);line-height:1.5;color:inherit;opacity:.95}
         .hero-copy.small h1{font-size:clamp(1.75rem,5vw,2.4rem)}
         .step{display:flex;flex-direction:column;gap:2rem}
         .benefits{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem;margin-top:1rem}
         .benefit{text-align:center;color:inherit}
         .benefit h3{font-size:clamp(1.1rem,2.5vw,1.3rem);margin:.5rem 0;color:inherit}
         .benefit p{font-size:clamp(.9rem,2vw,1rem);opacity:.9;line-height:1.5;color:inherit}
         .benefit .emoji{font-size:clamp(2.5rem,6vw,3rem);margin-bottom:.5rem}
         .center{text-align:center;margin-top:1.5rem}
         .field{display:flex;flex-direction:column;margin-bottom:1.25rem}
         label{font-weight:600;margin-bottom:.5rem;color:inherit;font-size:.95rem}
         input,select{border:2px solid var(--border-color,#e0e0e0);border-radius:10px;padding:1rem;font-size:1rem;background:var(--input-background,#fff);color:inherit;width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none;transition:border-color .2s}
         input:focus,select:focus{outline:none;border-color:var(--primary-color)}
         input[aria-invalid="true"],select[aria-invalid="true"]{border-color:#c33}
         input::placeholder,select::placeholder{color:var(--placeholder-color,#999);opacity:1}
         select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 1rem center;padding-right:2.5rem}
         .error{color:#c33;font-size:.85rem;margin-top:.4rem;display:block}
         .note{color:inherit;font-size:.85rem;margin-top:.4rem;display:block;opacity:.7}
         .req{color:#c33}
         .muted{color:inherit;opacity:.7;font-size:.85rem;text-align:center;margin-top:.75rem;margin-bottom:0}
         .muted.i{font-style:italic}
         .cta-button{width:100%;padding:1.15rem 1.5rem;font-size:1.1rem;font-weight:700;border-radius:10px;cursor:pointer;transition:all .2s;min-height:52px}
         .cta-button:disabled{opacity:.6;cursor:not-allowed}
         .cta-button:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.2)}
         .cta-secondary{padding:1rem 2rem;font-size:1rem;min-height:48px}
         .link{margin:1rem auto 0;display:block;background:transparent;border:none;color:inherit;text-decoration:underline;opacity:.7;cursor:pointer;font-size:.9rem;padding:.5rem}
         .link:hover{opacity:1}
         .hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
         .emoji.big{font-size:clamp(2.5rem,8vw,3.5rem);margin-bottom:.5rem}
         /* modal */
         .modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem}
         .modal{background:var(--card-background,#fff);border-radius:16px;padding:2rem;max-width:520px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:modalIn .25s ease-out;color:var(--text-color,#333)}
         .modal h2{font-size:clamp(1.5rem,4vw,1.8rem);margin-bottom:1rem;color:inherit}
         .modal p{font-size:clamp(.95rem,2.5vw,1.1rem);line-height:1.6;color:inherit}
         .modal-icon{width:clamp(64px,15vw,80px);height:clamp(64px,15vw,80px);border-radius:50%;background:var(--primary-color);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:clamp(1.75rem,5vw,2.5rem);color:#fff}
         .modal-actions{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;margin-top:1.5rem}
         .modal-actions button{flex:1;min-width:140px}
         @keyframes modalIn{from{opacity:0;transform:translateY(-12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
         
         /* Mobile optimizations */
         @media (max-width:768px){
           .hero-section{padding:1.5rem 1rem;margin:1rem auto}
           .card{padding:1.75rem 1.5rem;border-radius:16px}
           .hero-copy{margin-bottom:1.5rem;padding:0 .5rem}
           .benefits{grid-template-columns:1fr;gap:1.75rem;padding:0 1rem}
           .step{gap:1.5rem}
         }
         
         @media (max-width:480px){
           .hero-section{padding:1rem .75rem;margin:.75rem auto}
           .card{padding:1.5rem 1.25rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15)}
           .hero-copy{padding:0}
           .field{margin-bottom:1rem}
           input,select{padding:.9rem;font-size:.95rem;border-radius:8px}
           .cta-button{padding:1rem 1.25rem;font-size:1rem;border-radius:8px}
           .modal{padding:1.75rem 1.25rem;border-radius:12px}
           .modal-actions{flex-direction:column;gap:.75rem}
           .modal-actions button{width:100%;min-width:unset}
           .benefits{padding:0 .5rem;gap:1.5rem}
           label{font-size:.9rem}
           .muted{font-size:.8rem}
         }
         
         @media (max-width:360px){
           .card{padding:1.25rem 1rem}
           .hero-copy h1{font-size:1.75rem}
         }
       `}</style>
    </>
  )
}