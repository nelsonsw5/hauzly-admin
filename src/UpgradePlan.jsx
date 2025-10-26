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
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [userData, setUserData] = useState(null)

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
      const priceId = billingCycle === 'yearly' 
        ? subscriptionPlans[selectedPlan].priceYearlyId 
        : subscriptionPlans[selectedPlan].priceMonthlyId

      if (!priceId) {
        throw new Error('Invalid plan selection')
      }

      // Get promotion code from URL if present
      const params = new URLSearchParams(location.search)
      const promoCode = params.get('code')

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
        ...(promoCode && {
          discount: {
            promotion_code: promoCode
          }
        })
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
          
          /* Dark mode support for UpgradePlan */
          @media (prefers-color-scheme: dark) {
            .upgrade-plan-container {
              background-color: #1a1a1a !important;
              color: #ffffff !important;
            }
            
            .upgrade-plan-title {
              color: #ffffff !important;
            }
            
            .billing-toggle-container {
              background-color: #2d2d2d !important;
            }
            
            .billing-option {
              color: #ffffff !important;
            }
            
            .billing-option.active {
              background-color: #3a3a3a !important;
              box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1) !important;
            }
            
            .billing-option-label {
              color: #ffffff !important;
            }
            
            .billing-option-sublabel {
              color: rgba(255, 255, 255, 0.7) !important;
            }
            
            .plan-card {
              background: #2d2d2d !important;
              border-color: #404040 !important;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
            }
            
            .plan-card.selected {
              border-color: var(--primary-color) !important;
              box-shadow: 0 4px 14px rgba(0, 191, 179, 0.25) !important;
            }
            
            .plan-card h3 {
              color: #ffffff !important;
            }
            
            .plan-card li {
              color: rgba(255, 255, 255, 0.8) !important;
            }
            
            .plan-price-period {
              color: rgba(255, 255, 255, 0.7) !important;
            }
            
            .plan-yearly-note {
              color: rgba(255, 255, 255, 0.6) !important;
            }
            
            .upgrade-overlay {
              background-color: rgba(26, 26, 26, 0.95) !important;
            }
            
            .error-message {
              color: #ff6b6b !important;
            }
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

        {/* Subscription Plans grid */}
        <div
          style={{ 
            display: 'grid',
            gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
            width: '100%',
            marginBottom: '2rem'
          }} 
        >
          {Object.entries(subscriptionPlans)
            .filter(([planId]) => {
              // Hide family plan if toggle is off
              if (planId === 'family' && !showFamilyPlan) return false
              // Only show family plan on yearly billing
              return billingCycle === 'yearly' || planId !== 'family'
            })
            .map(([planId, plan]) => {
              const { amount, period } = getDisplayPrice(planId)
              const isSelected = selectedPlan === planId
              return (
                <button
                  key={planId}
                  className={`plan-card ${isSelected ? 'selected' : ''}`}
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
                    <span className="plan-price-period" style={{ marginLeft: 6, color: 'var(--text-dark)', opacity: 0.7 }}>{period}</span>
                  </div>

                  {planId === 'family' && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                      *only for yearly subscriptions
                    </div>
                  )}

                  {billingCycle === 'yearly' && plan.priceYearly && plan.priceMonthly && (
                    <div className="plan-yearly-note" style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-dark)', opacity: 0.6 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                        ${(parseFloat(plan.priceMonthly.replace('$', '')) * 12).toFixed(2)}
                      </span>
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
