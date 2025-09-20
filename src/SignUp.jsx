import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'

const plans = {
  onetime: {
    name: 'One-Time Haul',
    priceMonthly: '$5.00',
    periodMonthly: 'per haul',
    features: ['Pay per haul'],
  },
  basic: {
    name: 'Basic',
    priceMonthly: '$8.00',
    periodMonthly: '/month',
    priceYearly: '$86.40',
    periodYearly: '/year',
    yearlyDiscount: '10% off',
    features: ['2 pickups per month'],
  },
  premium: {
    name: 'Premium',
    priceMonthly: '$15.00',
    periodMonthly: '/month',
    priceYearly: '$162.00',
    periodYearly: '/year',
    yearlyDiscount: '10% off',
    features: ['Unlimited pickups'],
  },
  family: {
    name: 'Family',
    priceYearly: '$150.00',
    periodYearly: '/year',
    features: ['Up to 6 people', 'Unlimited pickups'],
  },
}

function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()

  const [selectedPlan, setSelectedPlan] = useState(location.state?.selectedPlan || 'basic')
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'yearly'

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [receiveTextUpdates, setReceiveTextUpdates] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function getDisplayPrice(planId) {
    const plan = plans[planId]
    // Family plan is yearly-only
    if (planId === 'family') {
      return { amount: plan.priceYearly, period: plan.periodYearly }
    }
    if (billingCycle === 'yearly' && plan.priceYearly) {
      return { amount: plan.priceYearly, period: plan.periodYearly }
    }
    return { amount: plan.priceMonthly, period: plan.periodMonthly }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` })

      const displayPrice = getDisplayPrice(selectedPlan)
      const actualBillingCycle = selectedPlan === 'family' ? 'yearly' : billingCycle

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        firstName,
        lastName,
        phoneNumber: phoneNumber.replace(/\D/g, ''),
        type: 'customer',
        isAdmin: false,
        approved: true,
        streetAddress,
        city,
        state,
        zip,
        receiveTextUpdates,
        plan: {
          type: selectedPlan,
          name: plans[selectedPlan].name,
          billingCycle: actualBillingCycle,
          price: displayPrice.amount,
          period: displayPrice.period,
          features: plans[selectedPlan].features,
          yearlyDiscount: plans[selectedPlan].yearlyDiscount,
          startDate: new Date().toISOString(),
          status: 'active',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="main-content" style={{ padding: '1rem' }}>
      <section
        className="form-container"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Plans */}
        <div
          style={{
            flex: '1 1 560px',
            backgroundColor: 'var(--background-light)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0, 45, 71, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>Choose Your Plan</h2>

            {/* Billing toggle */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.5rem',
                backgroundColor: 'var(--text-light)',
                borderRadius: '999px',
                boxShadow: '0 2px 4px rgba(0, 45, 71, 0.1)',
                whiteSpace: 'nowrap',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: billingCycle === 'monthly' ? 'var(--primary-color)' : 'var(--text-dark)',
                  fontWeight: billingCycle === 'monthly' ? 700 : 500,
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle((b) => (b === 'monthly' ? 'yearly' : 'monthly'))}
                aria-label="Toggle billing cycle"
                style={{
                  width: '48px',
                  height: '24px',
                  background: 'var(--text-light)',
                  borderRadius: '12px',
                  border: '2px solid var(--primary-color)',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: billingCycle === 'yearly' ? '24px' : 0,
                    width: '20px',
                    height: '20px',
                    background: 'var(--primary-color)',
                    borderRadius: '50%'
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: billingCycle === 'yearly' ? 'var(--primary-color)' : 'var(--text-dark)',
                  fontWeight: billingCycle === 'yearly' ? 700 : 500,
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Yearly
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-light)',
                    backgroundColor: 'var(--primary-color)',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  Save 10%
                </span>
              </button>
            </div>
          </div>

          {/* Plans grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              width: '100%'
            }}
          >
            {Object.entries(plans).map(([planId, plan]) => {
              const { amount, period } = getDisplayPrice(planId)
              const isSelected = selectedPlan === planId
              return (
                <button
                  key={planId}
                  onClick={() => setSelectedPlan(planId)}
                  style={{
                    textAlign: 'left',
                    border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: 'var(--text-light)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 4px 14px rgba(0, 191, 179, 0.15)' : '0 2px 4px rgba(0, 45, 71, 0.05)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>{plan.name}</h3>
                    {isSelected && (
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'var(--primary-color)',
                          color: 'var(--text-light)',
                          fontWeight: 700,
                          boxShadow: '0 2px 4px rgba(0, 191, 179, 0.3)',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-color)' }}>{amount}</span>
                    <span style={{ marginLeft: 6, color: 'var(--text-dark)', opacity: 0.7 }}>{period}</span>
                  </div>

                  {planId === 'family' && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                      Annual subscription only
                    </div>
                  )}
                  {billingCycle === 'yearly' && plan.priceYearly && plan.priceMonthly && plan.yearlyDiscount && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-dark)', opacity: 0.6 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                        ${parseFloat(plan.priceMonthly.replace('$', '')) * 12}
                      </span>
                      <span style={{ marginLeft: 8, color: 'var(--primary-color)', fontWeight: 600 }}>({plan.yearlyDiscount})</span>
                    </div>
                  )}

                  <ul style={{ margin: '0.75rem 0 0 1rem', padding: 0 }}>
                    {plan.features.map((f, idx) => (
                      <li key={idx} style={{ color: 'var(--text-dark)', opacity: 0.8, fontFamily: 'var(--font-body)' }}>✓ {f}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Form */}
        <div
          style={{
            flex: '1 1 520px',
            background: 'var(--text-light)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 4px 12px rgba(0, 45, 71, 0.1)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ marginTop: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>Create Your Account</h2>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
            </div>

            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Street Address" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} style={inputStyle} />

            <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} />
            </div>

            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dark)', fontFamily: 'var(--font-body)' }}>
              <input 
                type="checkbox" 
                checked={receiveTextUpdates} 
                onChange={(e) => setReceiveTextUpdates(e.target.checked)}
                style={{ accentColor: 'var(--primary-color)' }}
              />
              Receive text updates about your packages
            </label>

            {error && <div style={{ color: '#dc2626', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.9rem 1rem',
                background: 'var(--primary-color)',
                color: 'var(--text-light)',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 191, 179, 0.2)',
              }}
            >
              {submitting ? 'Creating account...' : 'Sign Up'}
            </button>

            <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontFamily: 'var(--font-body)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'underline', fontWeight: 600 }}>
                Login
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}

const inputStyle = {
  padding: '0.9rem 1rem',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  fontSize: '1rem',
  minHeight: 44,
  width: '100%',
  fontFamily: 'var(--font-body)',
  color: 'var(--text-dark)',
  backgroundColor: 'var(--text-light)',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  outline: 'none',
}

export default SignUp