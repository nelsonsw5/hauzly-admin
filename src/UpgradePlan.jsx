import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import { loadStripe } from '@stripe/stripe-js'

// Firebase Cloud Function URLs
const FIREBASE_FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_URL

// Toggle to show/hide Family plan - set to false to hide it
const showFamilyPlan = false

function UpgradePlan() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // State declarations
  const [priceData, setPriceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [planType, setPlanType] = useState('subscription')
  const [billingCycle, setBillingCycle] = useState('yearly')
  const [selectedPlan, setSelectedPlan] = useState('basic')
  const [promoCode, setPromoCode] = useState('HOLIDAYS') // Auto-apply HOLIDAYS promo code for Basic plan
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [userData, setUserData] = useState(null)
  const [showPremiumPlan, setShowPremiumPlan] = useState(false)

  // Helper functions
  const getDisplayPrice = (planId) => {
    if (!priceData) return { amount: '$0.00', period: '/month' }

    const plan = subscriptionPlans[planId]
    if (!plan) return { amount: '$0.00', period: '/month' }

    return {
      amount: billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
      period: billingCycle === 'yearly' ? plan.periodYearly : plan.periodMonthly
    }
  }

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      if (!auth.currentUser) {
        navigate('/login')
        return
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        } else {
          setError('Unable to load user data')
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
        setError('Unable to load user data')
      }
    }

    fetchUserData()
  }, [navigate])

  // Fetch premium feature flag
  useEffect(() => {
    async function fetchPremiumFeatureFlag() {
      try {
        const premiumFlagRef = doc(db, 'feature_flags', 'premium')
        const premiumFlagDoc = await getDoc(premiumFlagRef)
        
        if (premiumFlagDoc.exists()) {
          const flagData = premiumFlagDoc.data()
          console.log('Premium feature flag:', flagData)
          // Check for either 'show' or 'enabled' field
          const isEnabled = flagData.show === true || flagData.enabled === true
          setShowPremiumPlan(isEnabled)
        } else {
          console.log('No premium feature flag found, defaulting to true')
          // Default to true if no flag exists (backward compatibility)
          setShowPremiumPlan(true)
        }
      } catch (err) {
        console.error('Error fetching premium feature flag:', err)
        // Default to true on error (backward compatibility)
        setShowPremiumPlan(true)
      }
    }

    fetchPremiumFeatureFlag()
  }, [])

  // Fetch price data from Firestore
  useEffect(() => {
    async function fetchPriceData() {
      try {
        const settingsRef = doc(db, 'settings', 'products')
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          console.log('Fetched price data:', data)
          console.log('Subscription plans:', data.subscriptionPlans)
          setPriceData(data)
        } else {
          console.error('No products document found in settings collection')
          setError('Unable to load pricing information')
        }
      } catch (err) {
        console.error('Error fetching price data:', err)
        setError('Unable to load pricing information')
      } finally {
        setLoading(false)
      }
    }

    fetchPriceData()
  }, [])

  // Compute derived data
  const subscriptionPlans = priceData?.subscriptionPlans || {}

  // Show loading state while fetching prices
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4">Loading pricing information...</h2>
      </div>
    )
  }

  // Show error if price data couldn't be loaded
  if (!priceData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Unable to load pricing information</h2>
        <p>Please try again later or contact support if the problem persists.</p>
      </div>
    )
  }

  const handleUpgrade = async () => {
    if (!auth.currentUser || !userData) {
      navigate('/login')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      // Validate promo code if entered
      if (promoCode.trim()) {
        const validPromoCodes = ['HOLIDAYS', 'LEXI', 'CHELSEA', 'CAROLINE', 'CAMI', 'MIKAELA', 'JEZNI', 'HAULZY-INFLUENCER', 'INFLUENCER'];
        if (!validPromoCodes.includes(promoCode.trim().toUpperCase())) {
          throw new Error(`Invalid promo code: "${promoCode}"`);
        }
      }

      let priceId = billingCycle === 'yearly' 
        ? subscriptionPlans[selectedPlan].priceYearlyId 
        : subscriptionPlans[selectedPlan].priceMonthlyId

      // Special promo code mapping for Basic Yearly plan
      const specialPromoCodes = ['CAMI', 'CHELSEA', 'CAROLINE', 'LEXI', 'MIKAELA', 'JEZNI', 'HOLIDAYS'];
      if (selectedPlan === 'basic' && billingCycle === 'yearly' && promoCode.trim() && specialPromoCodes.includes(promoCode.trim().toUpperCase())) {
        console.log('🎟️ Special promo code detected, mapping to price_1SSAUJ7TZwWADd5cLUKUPRYM');
        priceId = 'price_1SSAUJ7TZwWADd5cLUKUPRYM';
      }

      if (!priceId) {
        throw new Error('Invalid plan selection')
      }

      // Prepare the payload
      const payload = {
        price_id: priceId,
        uid: auth.currentUser.uid,
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        ...(userData.phoneNumber && { phone: userData.phoneNumber }),
        address: {
          line1: userData.streetAddress,
          city: userData.city,
          state: userData.state,
          postal_code: userData.zip,
          country: 'US'
        },
        ...(promoCode.trim() && { promotion_code: promoCode.trim().toUpperCase() })
      }

      // Process subscription purchase
      const response = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/purchase_subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        console.error('Purchase failed:', errorData)
        throw new Error(errorData?.message || 'Failed to process purchase')
      }

      const data = await response.json()
      console.log('Purchase processed successfully:', data)

      // Redirect to checkout
      if (data.url) {
        window.location.href = data.url
      } else if (data.sessionId) {
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId })
        if (error) throw error
      } else {
        throw new Error('No checkout URL or session ID provided')
      }
      
    } catch (err) {
      console.error('Error during upgrade:', err)
      setError(err.message || 'Failed to process upgrade. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="main-content" style={{ padding: '0.5rem', minHeight: '100vh', position: 'relative' }}>
      {submitting && (
        <div
          className="upgrade-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              border: '4px solid var(--primary-color)',
              borderRadius: '50%',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              marginBottom: '2rem',
            }}
          />
          <h2
            style={{
              color: 'var(--primary-color)',
              fontFamily: 'var(--font-heading)',
              textAlign: 'center',
              margin: 0,
              marginBottom: '1rem',
            }}
          >
            Processing Your Upgrade
          </h2>
          <p
            style={{
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-body)',
              textAlign: 'center',
              margin: 0,
              opacity: 0.8,
              maxWidth: '300px',
            }}
          >
            We're preparing your checkout session...
          </p>
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <section
        className="form-container upgrade-plan-container"
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <h1 className="upgrade-plan-title" style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          color: 'var(--text-dark)',
          fontFamily: 'var(--font-heading)',
          fontSize: '2rem',
          fontWeight: 'bold'
        }}>
          Upgrade Your Plan
        </h1>

        {/* Billing toggle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '1rem 0',
          }}
        >
          <div
            className="billing-toggle-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
              backgroundColor: 'var(--background-light)',
              padding: '0.5rem',
              borderRadius: '12px',
              position: 'relative',
              width: 'fit-content',
            }}
          >
            {/* Monthly Option */}
            <div
              className={`billing-option ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => {
                setBillingCycle('monthly')
                if (selectedPlan === 'family') {
                  setSelectedPlan('basic')
                  setPromoCode('HOLIDAYS') // Auto-apply for Basic
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                position: 'relative',
                backgroundColor: billingCycle === 'monthly' ? 'white' : 'transparent',
                borderRadius: '8px',
                boxShadow: billingCycle === 'monthly' ? '0 2px 8px rgba(0, 45, 71, 0.1)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <span className="billing-option-label" style={{
                fontSize: '1rem',
                fontWeight: billingCycle === 'monthly' ? 700 : 500,
                color: billingCycle === 'monthly' ? 'var(--primary-color)' : 'var(--text-dark)',
                transition: 'all 0.3s ease',
              }}>
                Monthly
              </span>
              <span className="billing-option-sublabel" style={{
                fontSize: '0.85rem',
                color: 'var(--text-dark)',
                opacity: 0.7,
                marginTop: '0.25rem',
              }}>
                Regular price
              </span>
            </div>

            {/* Yearly Option */}
            <div
              className={`billing-option ${billingCycle === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('yearly')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                position: 'relative',
                backgroundColor: billingCycle === 'yearly' ? 'white' : 'transparent',
                borderRadius: '8px',
                boxShadow: billingCycle === 'yearly' ? '0 2px 8px rgba(0, 45, 71, 0.1)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <span className="billing-option-label" style={{
                fontSize: '1rem',
                fontWeight: billingCycle === 'yearly' ? 700 : 500,
                color: billingCycle === 'yearly' ? 'var(--primary-color)' : 'var(--text-dark)',
                transition: 'all 0.3s ease',
              }}>
                Yearly
              </span>
              <span className="billing-option-sublabel" style={{
                fontSize: '0.85rem',
                color: 'var(--text-dark)',
                opacity: 0.7,
                marginTop: '0.25rem',
              }}>
                Save 10%
              </span>
              {billingCycle === 'yearly' && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '999px',
                  boxShadow: '0 2px 4px rgba(0, 191, 179, 0.2)',
                }}>
                  Best Value
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Selection Cards */}
        <div
          style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            maxWidth: '900px',
            margin: '0 auto 2rem',
            width: '100%'
          }} 
        >
          {/* Basic Plan */}
          {subscriptionPlans.basic && (
            <div
              onClick={() => {
                setSelectedPlan('basic')
                setPromoCode('HOLIDAYS') // Auto-apply HOLIDAYS for Basic plan
              }}
              className={`plan-card ${selectedPlan === 'basic' ? 'selected' : ''}`}
              style={{ 
                textAlign: 'center',
                border: selectedPlan === 'basic' ? '3px solid var(--primary-color)' : '2px solid var(--border-color)',
                background: 'var(--text-light)',
                borderRadius: '12px',
                padding: '1.5rem', 
                boxShadow: selectedPlan === 'basic' ? '0 6px 20px rgba(0, 191, 179, 0.25)' : '0 2px 8px rgba(0, 45, 71, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                transform: selectedPlan === 'basic' ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (selectedPlan !== 'basic') {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 45, 71, 0.12)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPlan !== 'basic') {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 45, 71, 0.08)'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              {selectedPlan === 'basic' && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0, 191, 179, 0.4)'
                }}>
                  ✓
                </div>
              )}
              
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-dark)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
                Basic
              </h3>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {getDisplayPrice('basic').amount}
                </span>
                <span className="plan-price-period" style={{ marginLeft: 6, color: 'var(--text-dark)', opacity: 0.7, fontSize: '1.1rem' }}>
                  {getDisplayPrice('basic').period}
                </span>
              </div>

              {billingCycle === 'yearly' && subscriptionPlans.basic.priceYearly && subscriptionPlans.basic.priceMonthly && (
                <div className="plan-yearly-note" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-dark)', opacity: 0.6 }}>
                  <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                    ${(parseFloat(subscriptionPlans.basic.priceMonthly.replace('$', '')) * 12).toFixed(2)}
                  </span>
                  <span style={{ marginLeft: '8px', color: 'var(--primary-color)', fontWeight: 600 }}>Save 10%</span>
                </div>
              )}

              <ul style={{ margin: '0', padding: 0, listStyle: 'none', textAlign: 'left' }}>
                {subscriptionPlans.basic.features.map((f, idx) => (
                  <li key={idx} style={{ color: 'var(--text-dark)', opacity: 0.8, fontFamily: 'var(--font-body)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Premium Plan */}
          {showPremiumPlan && subscriptionPlans.premium && (
            <div
              onClick={() => {
                setSelectedPlan('premium')
                setPromoCode('') // Clear promo code for Premium plan
              }}
              className={`plan-card ${selectedPlan === 'premium' ? 'selected' : ''}`}
              style={{ 
                textAlign: 'center',
                border: selectedPlan === 'premium' ? '3px solid var(--primary-color)' : '2px solid var(--border-color)',
                background: 'var(--text-light)',
                borderRadius: '12px',
                padding: '1.5rem', 
                boxShadow: selectedPlan === 'premium' ? '0 6px 20px rgba(0, 191, 179, 0.25)' : '0 2px 8px rgba(0, 45, 71, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                transform: selectedPlan === 'premium' ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (selectedPlan !== 'premium') {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 45, 71, 0.12)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPlan !== 'premium') {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 45, 71, 0.08)'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              {selectedPlan === 'premium' && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0, 191, 179, 0.4)'
                }}>
                  ✓
                </div>
              )}
              
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                boxShadow: '0 2px 4px rgba(0, 191, 179, 0.3)',
                whiteSpace: 'nowrap'
              }}>
                MOST POPULAR
              </div>
              
              <h3 style={{ margin: '2rem 0 1rem 0', color: 'var(--text-dark)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
                Premium
              </h3>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {getDisplayPrice('premium').amount}
                </span>
                <span className="plan-price-period" style={{ marginLeft: 6, color: 'var(--text-dark)', opacity: 0.7, fontSize: '1.1rem' }}>
                  {getDisplayPrice('premium').period}
                </span>
              </div>

              {billingCycle === 'yearly' && subscriptionPlans.premium.priceYearly && subscriptionPlans.premium.priceMonthly && (
                <div className="plan-yearly-note" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-dark)', opacity: 0.6 }}>
                  <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                    ${(parseFloat(subscriptionPlans.premium.priceMonthly.replace('$', '')) * 12).toFixed(2)}
                  </span>
                  <span style={{ marginLeft: '8px', color: 'var(--primary-color)', fontWeight: 600 }}>Save 10%</span>
                </div>
              )}

              <ul style={{ margin: '0', padding: 0, listStyle: 'none', textAlign: 'left' }}>
                {subscriptionPlans.premium.features.map((f, idx) => (
                  <li key={idx} style={{ color: 'var(--text-dark)', opacity: 0.8, fontFamily: 'var(--font-body)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Promo Code Input */}
        <div style={{ 
          maxWidth: '400px', 
          margin: '0 auto 1.5rem',
          position: 'relative'
        }}>
          <input 
            type="text" 
            placeholder="Promo Code (optional)" 
            value={promoCode} 
            onChange={(e) => {
              // Only allow changes if Premium is selected
              if (selectedPlan === 'premium') {
                setPromoCode(e.target.value.toUpperCase())
              }
            }}
            readOnly={selectedPlan === 'basic'}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '1rem',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-dark)',
              backgroundColor: selectedPlan === 'basic' ? 'rgba(0, 191, 179, 0.05)' : 'var(--text-light)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              outline: 'none',
              transition: 'border-color 0.2s ease, background-color 0.2s ease',
              boxSizing: 'border-box',
              cursor: selectedPlan === 'basic' ? 'not-allowed' : 'text'
            }} 
          />
          {promoCode && ['HOLIDAYS', 'LEXI', 'CHELSEA', 'CAROLINE', 'CAMI', 'MIKAELA', 'JEZNI', 'HAULZY-INFLUENCER', 'INFLUENCER'].includes(promoCode.toUpperCase()) && (
            <span style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--primary-color)',
              fontWeight: '600',
              fontSize: '0.85rem',
              backgroundColor: 'rgba(0, 191, 179, 0.1)',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              {promoCode.toUpperCase() === 'HAULZY-INFLUENCER' ? '1 year free' : promoCode.toUpperCase() === 'INFLUENCER' ? '3 months free' : '2 months free'}
            </span>
          )}
          {selectedPlan === 'basic' && (
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--primary-color)',
              marginTop: '0.5rem',
              textAlign: 'center',
              fontFamily: 'var(--font-body)',
              fontWeight: 600
            }}>
              ✨ HOLIDAYS promo code automatically applied - 2 months free!
            </div>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ 
            color: '#dc2626', 
            fontSize: '0.9rem', 
            fontFamily: 'var(--font-body)',
            textAlign: 'center',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <button 
          onClick={handleUpgrade}
          disabled={submitting}
          style={{ 
            width: '100%',
            maxWidth: '400px',
            margin: '0 auto',
            display: 'block',
            padding: '1rem 1.25rem',
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
            minHeight: '48px',
            fontSize: '1.1rem',
          }}
        >
          {submitting ? 'Processing...' : 'Upgrade Now'}
        </button>
      </section>
    </main>
  )
}

export default UpgradePlan
