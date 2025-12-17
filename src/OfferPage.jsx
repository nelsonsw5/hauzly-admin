import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from './firebase'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import facebookReviews from './assets/IMG_4657.PNG'

/**
 * OfferPage – high-converting, purpose-built landing page
 * Optimized for cold traffic → trust → action
 * - Single-purpose: Get first free pickup scheduled
 * - Social proof prominent above the fold
 * - 10-second explainer with visual steps
 * - Two-step flow: capture lead → schedule details
 * - Mobile-first responsive design
 * - Auto-applied coupon messaging
 * - Attribution tracking (utm_*, fbclid, referrer)
 * - Honeypot spam protection
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

      <section className="offer-page">
        {step === 1 && (
          <div className="step step-1">
            {/* Hero - Above the Fold */}
            <header className="hero-copy">
              <div className="offer-badge">🎁 Enter your email to claim your free pickup</div>
              <h1>Never Stand in Return Lines Again</h1>
              <p className="hero-subtitle">Boxes, labels, and return lines… handled for you. <strong className="accent">Get your first return picked up free.</strong></p>
            </header>

            {/* Lead Capture Form */}
            <form onSubmit={onStep1} className="card">
              <h2 className="form-title">Secure Your Free Pickup</h2>
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
                  placeholder="84663"
                  inputMode="numeric"
                  maxLength={5}
                  aria-invalid={!!errors.zipCode}
                />
                {errors.zipCode && <small className="error">{errors.zipCode}</small>}
                {!!formData.zipCode && !errors.zipCode && !isServiceZip(formData.zipCode) && (
                  <small className="note">We're expanding! Join the waitlist and we'll notify you when we reach your area.</small>
                )}
              </div>

              {/* Honeypot */}
              <input type="text" name="honey" value={formData.honey} onChange={onChange} className="hp" tabIndex="-1" autoComplete="off" />

              <button type="submit" className="cta-button" disabled={submitting}>
                {submitting ? 'Saving…' : 'Get My Free Pickup →'}
              </button>
              <p className="muted">✓ No credit card required  •  ✓ Takes 20 seconds</p>
            </form>

            {/* How It Works - 10 Second Explainer */}
            <div className="how-it-works">
              <h2>How Haulzy Works</h2>
              <div className="steps">
                <div className="step-item">
                  <div className="step-number">1</div>
                  <div className="step-icon">📅</div>
                  <h3>Schedule Your Pickup</h3>
                  <p>Pick a day and time that works for you</p>
                </div>
                <div className="step-item">
                  <div className="step-number">2</div>
                  <div className="step-icon">📦</div>
                  <h3>Hand Us the Item</h3>
                  <p>Or leave it on your porch — no labels, no printer, no box needed</p>
                </div>
                <div className="step-item">
                  <div className="step-number">3</div>
                  <div className="step-icon">✨</div>
                  <h3>We Return It For You</h3>
                  <p>Track your return and get your refund — all handled</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="benefits">
              <div className="benefit"><div className="emoji">🏠</div><h3>Doorstep Pickup</h3><p>No post office trips. No waiting in line. We come to you.</p></div>
              <div className="benefit"><div className="emoji">⚡</div><h3>Fast & Easy</h3><p>Schedule in 20 seconds. We handle everything else.</p></div>
              <div className="benefit"><div className="emoji">💰</div><h3>First One's Free</h3><p>Try it risk-free. Your first pickup is completely on us.</p></div>
            </div>

            {/* Real Customer Reviews from Facebook */}
            <div className="testimonials">
              <h2>Real Reviews from Real Customers</h2>
              <p className="testimonials-subtitle">See what families are saying on Facebook</p>
              
              <div className="facebook-reviews-container">
                <img 
                  src={facebookReviews} 
                  alt="5-star Facebook reviews from Haulzy customers" 
                  className="facebook-reviews-image"
                />
              </div>

              {/* Highlighted Reviews */}
              <div className="testimonial-grid">
                <div className="testimonial">
                  <div className="stars">⭐⭐⭐⭐⭐</div>
                  <p>"Really happy I didn't have to take the time to load my kids up and take them to UPS to get my returns done. The team at Haulzy came in clutch!"</p>
                  <p className="author">— JohnHFr007</p>
                </div>
                <div className="testimonial">
                  <div className="stars">⭐⭐⭐⭐⭐</div>
                  <p>"I NEVER return things because finding the time to get around to it is hard! Now I just put it on my porch and it gets returned?! This is the best!"</p>
                  <p className="author">— Rt2020!</p>
                </div>
                <div className="testimonial">
                  <div className="stars">⭐⭐⭐⭐⭐</div>
                  <p>"Great idea. Great app. It's simply designed, and saves so much time. No packing up the kids in and out of the car to wait in line forever. Very smooth!"</p>
                  <p className="author">— Browe67</p>
                </div>
              </div>
            </div>

            <div className="center cta-repeat">
              <button className="cta-button-large" onClick={() => emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                Claim My Free Pickup Now →
              </button>
              <p className="muted">Join hundreds of families who never wait in line</p>
            </div>

            <div className="center">
              <button className="link-button" onClick={() => navigate('/')}>Learn More About Haulzy</button>
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

       {/* Enhanced styles for high-converting landing page */}
       <style>{`
         .offer-page{max-width:1200px;margin:0 auto;padding:2rem 1rem;background:var(--background-light,#FFFCF5);min-height:100vh}
         .accent{color:var(--primary-color,#00BFB3);font-weight:600}
         
         /* Hero Section */
         .hero-copy{max-width:900px;margin:0 auto 2rem;text-align:center;padding:0 1rem}
         .offer-badge{display:inline-block;background:linear-gradient(135deg,#00BFB3,#00a396);color:#fff;padding:.75rem 1.5rem;border-radius:50px;font-size:.95rem;font-weight:600;margin-bottom:1.5rem;box-shadow:0 4px 12px rgba(0,191,179,.3);animation:badgePulse 2s ease-in-out infinite}
         .hero-copy h1{font-family:var(--font-heading,'Poppins',sans-serif);font-size:clamp(2.25rem,7vw,4rem);line-height:1.1;margin:0 0 1.5rem;color:var(--text-dark,#002D47);font-weight:700;letter-spacing:-.02em}
         .hero-subtitle{font-size:clamp(1.125rem,3vw,1.5rem);line-height:1.6;color:var(--text-dark,#002D47);opacity:.9;max-width:700px;margin:0 auto}
         
         /* Social Proof */
         .social-proof{max-width:600px;margin:2rem auto;padding:1.5rem;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08)}
         .trust-badges{display:flex;flex-direction:column;align-items:center;gap:1rem}
         .trust-item{text-align:center}
         .stars{font-size:1.5rem;margin-bottom:.5rem;letter-spacing:2px}
         .trust-text{font-size:1rem;color:var(--text-dark,#002D47);opacity:.8;margin:0}
         
         /* Form Card */
         .card{background:#fff;padding:2.5rem;border-radius:20px;box-shadow:0 8px 32px rgba(0,47,71,.15);max-width:560px;margin:2rem auto;border:2px solid var(--primary-color,#00BFB3)}
         .form-title{font-family:var(--font-heading,'Poppins',sans-serif);font-size:1.75rem;text-align:center;margin:0 0 1.5rem;color:var(--text-dark,#002D47)}
         .field{display:flex;flex-direction:column;margin-bottom:1.25rem}
         label{font-weight:600;margin-bottom:.5rem;color:var(--text-dark,#002D47);font-size:.95rem}
         input,select{border:2px solid #e0e0e0;border-radius:10px;padding:1rem;font-size:1rem;background:#fff;color:var(--text-dark,#002D47);width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none;transition:all .2s;font-family:var(--font-body,'Inter',sans-serif)}
         input:focus,select:focus{outline:none;border-color:var(--primary-color,#00BFB3);box-shadow:0 0 0 3px rgba(0,191,179,.1)}
         input[aria-invalid="true"],select[aria-invalid="true"]{border-color:#c33}
         input::placeholder{color:#999;opacity:1}
         select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 1rem center;padding-right:2.5rem}
         .error{color:#c33;font-size:.85rem;margin-top:.4rem;display:block;font-weight:500}
         .note{color:var(--primary-color,#00BFB3);font-size:.85rem;margin-top:.4rem;display:block;font-weight:500}
         .req{color:#c33}
         .muted{color:var(--text-dark,#002D47);opacity:.6;font-size:.85rem;text-align:center;margin-top:.75rem;margin-bottom:0}
         .muted.i{font-style:italic}
         
         /* CTA Buttons */
         .cta-button{width:100%;padding:1.25rem 2rem;font-size:1.2rem;font-weight:700;border-radius:12px;cursor:pointer;transition:all .3s;min-height:56px;background:linear-gradient(135deg,var(--primary-color,#00BFB3),#00a396);color:#fff;border:none;box-shadow:0 4px 16px rgba(0,191,179,.3);font-family:var(--font-body,'Inter',sans-serif)}
         .cta-button:disabled{opacity:.6;cursor:not-allowed}
         .cta-button:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,191,179,.4)}
         .cta-button-large{padding:1.5rem 3rem;font-size:1.3rem;font-weight:700;border-radius:12px;cursor:pointer;transition:all .3s;background:linear-gradient(135deg,var(--primary-color,#00BFB3),#00a396);color:#fff;border:none;box-shadow:0 6px 24px rgba(0,191,179,.3);font-family:var(--font-body,'Inter',sans-serif);display:inline-block}
         .cta-button-large:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,191,179,.4)}
         .cta-secondary{padding:1rem 2rem;font-size:1rem;min-height:48px;background:transparent;border:2px solid var(--primary-color,#00BFB3);color:var(--primary-color,#00BFB3);border-radius:10px;cursor:pointer;transition:all .3s;font-weight:600}
         .cta-secondary:hover{background:var(--primary-color,#00BFB3);color:#fff}
         .link-button{background:transparent;border:none;color:var(--text-dark,#002D47);text-decoration:underline;opacity:.7;cursor:pointer;font-size:.95rem;padding:.75rem;transition:opacity .2s}
         .link-button:hover{opacity:1}
         
         /* How It Works */
         .how-it-works{max-width:900px;margin:3rem auto;padding:2rem 1rem;text-align:center}
         .how-it-works h2{font-family:var(--font-heading,'Poppins',sans-serif);font-size:clamp(1.75rem,5vw,2.5rem);margin-bottom:2rem;color:var(--text-dark,#002D47)}
         .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:2rem;margin-top:2rem}
         .step-item{position:relative;padding:2rem 1.5rem;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);transition:transform .3s}
         .step-item:hover{transform:translateY(-4px)}
         .step-number{position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:32px;height:32px;background:var(--primary-color,#00BFB3);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;box-shadow:0 2px 8px rgba(0,191,179,.3)}
         .step-icon{font-size:3rem;margin:1rem 0}
         .step-item h3{font-family:var(--font-heading,'Poppins',sans-serif);font-size:1.25rem;margin:.75rem 0;color:var(--text-dark,#002D47)}
         .step-item p{font-size:1rem;line-height:1.6;color:var(--text-dark,#002D47);opacity:.8;margin:0}
         
         /* Benefits */
         .benefits{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:2rem;margin:3rem auto;max-width:900px;padding:0 1rem}
         .benefit{text-align:center;padding:2rem 1.5rem;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);transition:transform .3s}
         .benefit:hover{transform:translateY(-4px)}
         .benefit .emoji{font-size:3rem;margin-bottom:1rem}
         .benefit h3{font-family:var(--font-heading,'Poppins',sans-serif);font-size:1.25rem;margin:.75rem 0;color:var(--text-dark,#002D47)}
         .benefit p{font-size:1rem;line-height:1.6;color:var(--text-dark,#002D47);opacity:.8;margin:0}
         
         /* Testimonials */
         .testimonials{max-width:1000px;margin:4rem auto;padding:2rem 1rem;text-align:center}
         .testimonials h2{font-family:var(--font-heading,'Poppins',sans-serif);font-size:clamp(1.75rem,5vw,2.5rem);margin-bottom:1rem;color:var(--text-dark,#002D47)}
         .testimonials-subtitle{font-size:1.125rem;color:var(--text-dark,#002D47);opacity:.7;margin-bottom:2.5rem}
         .facebook-reviews-container{max-width:700px;margin:0 auto 3rem;padding:1rem;background:#fff;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden}
         .facebook-reviews-image{width:100%;height:auto;display:block;border-radius:12px}
         .testimonial-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2rem;margin-top:2rem}
         .testimonial{background:#fff;padding:2rem;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);text-align:left;transition:transform .3s}
         .testimonial:hover{transform:translateY(-4px)}
         .testimonial .stars{font-size:1.25rem;margin-bottom:1rem;letter-spacing:2px}
         .testimonial p{font-size:1rem;line-height:1.7;color:var(--text-dark,#002D47);margin:0 0 1rem}
         .testimonial .author{font-size:.9rem;font-weight:600;color:var(--primary-color,#00BFB3);font-style:italic}
         
         /* Utility */
         .center{text-align:center;margin-top:2rem}
         .cta-repeat{margin:4rem auto;padding:2rem 1rem}
         .step{display:flex;flex-direction:column;gap:0}
         .hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
         .emoji.big{font-size:clamp(2.5rem,8vw,3.5rem);margin-bottom:.5rem}
         .link{margin:1rem auto 0;display:block;background:transparent;border:none;color:var(--text-dark,#002D47);text-decoration:underline;opacity:.7;cursor:pointer;font-size:.9rem;padding:.5rem}
         .link:hover{opacity:1}
         
         /* Modal */
         .modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem}
         .modal{background:#fff;border-radius:20px;padding:2.5rem;max-width:520px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:modalIn .25s ease-out;color:var(--text-dark,#002D47)}
         .modal h2{font-family:var(--font-heading,'Poppins',sans-serif);font-size:clamp(1.5rem,4vw,2rem);margin-bottom:1rem}
         .modal p{font-size:clamp(1rem,2.5vw,1.125rem);line-height:1.6}
         .modal-icon{width:clamp(64px,15vw,80px);height:clamp(64px,15vw,80px);border-radius:50%;background:var(--primary-color,#00BFB3);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:clamp(1.75rem,5vw,2.5rem);color:#fff;box-shadow:0 4px 16px rgba(0,191,179,.3)}
         .modal-actions{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;margin-top:1.5rem}
         .modal-actions button{flex:1;min-width:140px}
         
         /* Animations */
         @keyframes modalIn{from{opacity:0;transform:translateY(-12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
         @keyframes badgePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
         
         /* Step 2 styles */
         .hero-copy.small h1{font-size:clamp(1.75rem,5vw,2.4rem)}
         
         /* Mobile optimizations */
         @media (max-width:768px){
           .offer-page{padding:1rem .75rem}
           .hero-copy{padding:0 .5rem;margin-bottom:1.5rem}
           .offer-badge{font-size:.85rem;padding:.6rem 1.25rem}
           .card{padding:2rem 1.5rem;border-radius:16px;margin:1.5rem auto}
           .form-title{font-size:1.5rem}
           .social-proof{margin:1.5rem auto;padding:1.25rem}
           .how-it-works{margin:2rem auto;padding:1.5rem 1rem}
           .steps{grid-template-columns:1fr;gap:1.5rem}
           .benefits{grid-template-columns:1fr;gap:1.5rem;margin:2rem auto}
           .testimonials{margin:2.5rem auto;padding:1.5rem 1rem}
           .facebook-reviews-container{max-width:100%;padding:.75rem;border-radius:16px}
           .facebook-reviews-image{border-radius:8px}
           .testimonial-grid{grid-template-columns:1fr;gap:1.5rem}
           .cta-repeat{margin:2.5rem auto;padding:1.5rem 1rem}
           .cta-button-large{padding:1.25rem 2rem;font-size:1.1rem;width:100%}
         }
         
         @media (max-width:480px){
           .offer-page{padding:.75rem .5rem}
           .card{padding:1.5rem 1.25rem;border-radius:12px}
           .hero-copy{padding:0}
           .offer-badge{font-size:.8rem;padding:.5rem 1rem;margin-bottom:1rem}
           .field{margin-bottom:1rem}
           input,select{padding:.9rem;font-size:.95rem;border-radius:8px}
           .cta-button{padding:1rem 1.25rem;font-size:1rem;border-radius:8px}
           .cta-button-large{padding:1rem 1.5rem;font-size:1rem}
           .modal{padding:1.75rem 1.25rem;border-radius:12px}
           .modal-actions{flex-direction:column;gap:.75rem}
           .modal-actions button{width:100%;min-width:unset}
           .step-item{padding:1.5rem 1rem}
           .benefit{padding:1.5rem 1rem}
           .facebook-reviews-container{padding:.5rem;border-radius:12px}
           .testimonials-subtitle{font-size:1rem}
           .testimonial{padding:1.5rem}
           label{font-size:.9rem}
           .muted{font-size:.8rem}
         }
         
         @media (max-width:360px){
           .card{padding:1.25rem 1rem}
           .hero-copy h1{font-size:1.75rem}
           .offer-badge{font-size:.75rem;padding:.4rem .85rem}
         }
       `}</style>
    </>
  )
}