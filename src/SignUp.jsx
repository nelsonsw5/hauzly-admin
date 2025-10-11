import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import { fetchSignInMethodsForEmail } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { loadStripe } from '@stripe/stripe-js'

// Firebase Cloud Function URLs
const FIREBASE_FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_URL

// Toggle to show/hide Family plan - set to false to hide it
const showFamilyPlan = false

function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // All state declarations at the top
  const [priceData, setPriceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [planType, setPlanType] = useState(location.state?.selectedPlan === 'onetime' ? 'onetime' : 'subscription')
  const [billingCycle, setBillingCycle] = useState('yearly')
  const [selectedPlan, setSelectedPlan] = useState('basic')
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

  // Helper functions
  const getDisplayPrice = (planId) => {
    if (!priceData) return { amount: '$0.00', period: '/month' }

    if (planType === 'onetime') {
      return {
        amount: oneTimePlan.priceMonthly || '$0.00',
        period: oneTimePlan.periodMonthly || 'per haul'
      }
    }

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
          console.log('One-time plan:', data.oneTimePlan)
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
  const oneTimePlan = priceData?.oneTimePlan || {}

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


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate password match
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Check if user already exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (signInMethods.length > 0) {
        throw new Error('An account with this email already exists');
      }

      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Immediately create the user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber ? phoneNumber.replace(/\D/g, '') : null,
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        country: 'US',
        type: 'customer',
        isAdmin: false,
        pickupCredit: false,
        approved: true,
        receiveTextUpdates: receiveTextUpdates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update user profile with name
      await updateProfile(user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`
      });

      // For one-time hauls, skip the purchase process and navigate directly
      if (planType === 'onetime') {
        navigate('/download');
        return;
      }

      // Only proceed with billing setup for subscription plans
      const priceId = billingCycle === 'yearly' 
        ? subscriptionPlans[selectedPlan].priceYearlyId 
        : subscriptionPlans[selectedPlan].priceMonthlyId;

      if (!priceId) {
        throw new Error('Invalid plan selection');
      }

      // Get promotion code from URL if present
      const params = new URLSearchParams(location.search);
      const promoCode = params.get('code');

      // Prepare the payload with user UID
      const payload = {
        price_id: priceId,
        uid: user.uid,
        email: email.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        ...(phoneNumber && { phone: phoneNumber.replace(/\D/g, '') }),
        address: {
          line1: streetAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: zip.trim(),
          country: 'US'
        },
        ...(promoCode && {
          discount: {
            promotion_code: promoCode
          }
        })
      };

      // Process subscription purchase
      const response = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/purchase_subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Purchase failed:', errorData);
        throw new Error(errorData?.message || 'Failed to process purchase');
      }

      const data = await response.json();
      console.log('Purchase processed successfully:', data);

      // Redirect to checkout
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) throw error;
      } else {
        throw new Error('No checkout URL or session ID provided');
      }
      
    } catch (err) {
      console.error('Error during signup:', err);
      
      // If we created a user but checkout failed, clean up by deleting the user
      // Only do this for subscription plans, not one-time plans
      if (planType !== 'onetime' && err.message.includes('Failed to process purchase') && auth.currentUser) {
        try {
          // Delete the Firestore user document
          await deleteDoc(doc(db, 'users', auth.currentUser.uid));
          // Delete the auth user
          await auth.currentUser.delete();
        } catch (deleteErr) {
          console.error('Failed to clean up user after checkout error:', deleteErr);
        }
      }

      // Format user-friendly error messages
      let errorMessage = err.message;
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters long.';
            break;
          default:
            errorMessage = err.message || 'Failed to create account. Please try again.';
        }
      }

      setError(errorMessage);
      setSubmitting(false);
    }
  };

  return (
    <main className="main-content" style={{ padding: '0.5rem', minHeight: '100vh', position: 'relative' }}>
      {submitting && (
        <div
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
            Signing you up for Haulzy
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
            We're setting up your account and preparing your checkout session...
          </p>
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          input[type="checkbox"]:checked::after {
            content: '✓';
            color: white;
            font-size: ${window.innerWidth <= 768 ? '16px' : '14px'};
            font-weight: bold;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: block;
          }
        `}
      </style>
      <section
        className="form-container"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'stretch',
          flexWrap: 'wrap',
          width: '100%',
          // Replace the @media query with JavaScript conditional logic
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
        }}
      >
        {/* Left: Plans */}
        <div
          style={{
            flex: '1 1 300px',
            minWidth: '280px',
            backgroundColor: 'var(--background-light)',
            borderRadius: '12px',
            padding: window.innerWidth <= 768 ? '1rem' : '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0, 45, 71, 0.08)',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>Choose Your Plan</h2>

          {/* Plan Type Toggle */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.25rem',
              backgroundColor: 'var(--text-light)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPlanType('subscription')
                setSelectedPlan('basic')
              }}
              style={{
                flex: 1,
                padding: window.innerWidth <= 768 ? '0.875rem 0.75rem' : '0.75rem 1rem',
                background: planType === 'subscription' ? 'var(--primary-color)' : 'transparent',
                color: planType === 'subscription' ? 'var(--text-light)' : 'var(--text-dark)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
                minHeight: '44px',
              }}
            >
              Subscription Plans
            </button>
            <button
              type="button"
              onClick={() => setPlanType('onetime')}
              style={{
                flex: 1,
                padding: window.innerWidth <= 768 ? '0.875rem 0.75rem' : '0.75rem 1rem',
                background: planType === 'onetime' ? 'var(--primary-color)' : 'transparent',
                color: planType === 'onetime' ? 'var(--text-light)' : 'var(--text-dark)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
                minHeight: '44px',
              }}
            >
              One-Time Haul
            </button>
          </div>

          {/* Subscription Plans Section */}
          {planType === 'subscription' && (
            <>
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
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: billingCycle === 'monthly' ? 700 : 500,
                      color: billingCycle === 'monthly' ? 'var(--primary-color)' : 'var(--text-dark)',
                      transition: 'all 0.3s ease',
                    }}>
                      Monthly
                    </span>
                    <span style={{
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
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: billingCycle === 'yearly' ? 700 : 500,
                      color: billingCycle === 'yearly' ? 'var(--primary-color)' : 'var(--text-dark)',
                      transition: 'all 0.3s ease',
                    }}>
                      Yearly
                    </span>
                    <span style={{
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
                  gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
              width: '100%'
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
                          *only for yearly subscriptions
                        </div>
                      )}

                      {billingCycle === 'yearly' && plan.priceYearly && plan.priceMonthly && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-dark)', opacity: 0.6 }}>
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
            </>
          )}

          {/* One-Time Plan Section */}
          {planType === 'onetime' && (
            <div
              style={{
                border: '2px solid var(--primary-color)',
                background: 'var(--text-light)',
                borderRadius: '12px',
                padding: window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                boxShadow: '0 4px 14px rgba(0, 191, 179, 0.15)',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
                <span
                  aria-hidden
            style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    color: 'var(--text-light)',
                    fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(0, 191, 179, 0.3)',
                    marginRight: '1rem',
                  }}
                >
                  ✓
                </span>
                <h3 style={{ margin: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>{oneTimePlan.name}</h3>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>{oneTimePlan.priceMonthly}</span>
                <span style={{ marginLeft: 6, color: 'var(--text-dark)', opacity: 0.7, fontSize: '1.1rem' }}>{oneTimePlan.periodMonthly}</span>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: 'none', textAlign: 'center' }}>
                {oneTimePlan.features.map((f, idx) => (
                  <li key={idx} style={{ color: 'var(--text-dark)', opacity: 0.8, fontFamily: 'var(--font-body)', fontSize: '1.1rem' }}>✓ {f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div
          style={{
            flex: '1 1 300px',
            minWidth: '280px',
            background: 'var(--text-light)',
            borderRadius: '12px',
            padding: window.innerWidth <= 768 ? '1rem' : '1.25rem',
            boxShadow: '0 4px 12px rgba(0, 45, 71, 0.1)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ marginTop: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>Sign Up for Haulzy</h2>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: window.innerWidth <= 768 ? '0.75rem' : '0.9rem' }}>
            <div style={{ display: 'grid', gap: window.innerWidth <= 768 ? '0.75rem' : '0.9rem', gridTemplateColumns: window.innerWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
            </div>

            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Street Address" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} style={inputStyle} />

            <div style={{ display: 'grid', gap: window.innerWidth <= 768 ? '0.75rem' : '0.9rem', gridTemplateColumns: window.innerWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(100px, 1fr))' }}>
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} />
            </div>

            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />

            <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                color: 'var(--text-dark)', 
                fontFamily: 'var(--font-body)',
                fontSize: window.innerWidth <= 768 ? '0.95rem' : '1rem',
                padding: window.innerWidth <= 768 ? '0.5rem 0' : '0.25rem 0',
                userSelect: 'none'
              }}>
              <input 
                type="checkbox" 
                checked={receiveTextUpdates} 
                onChange={(e) => setReceiveTextUpdates(e.target.checked)}
                style={{ 
                  accentColor: 'var(--primary-color)',
                  width: window.innerWidth <= 768 ? '20px' : '16px',
                  height: window.innerWidth <= 768 ? '20px' : '16px',
                  margin: 0,
                  cursor: 'pointer',
                  border: '2px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--text-light)',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onInput={(e) => {
                  if (e.target.checked) {
                    e.target.style.backgroundColor = 'var(--primary-color)';
                    e.target.style.borderColor = 'var(--primary-color)';
                  } else {
                    e.target.style.backgroundColor = 'var(--text-light)';
                    e.target.style.borderColor = 'var(--border-color)';
                  }
                }}
              />
              <span style={{ flex: 1 }}>Receive text updates about your packages</span>
            </label>

            {error && <div style={{ color: '#dc2626', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>{error}</div>}

          <button 
            type="submit" 
            disabled={submitting}
            style={{ 
                padding: window.innerWidth <= 768 ? '1rem 1.25rem' : '0.9rem 1rem',
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
                fontSize: window.innerWidth <= 768 ? '1.1rem' : '1rem',
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
  padding: window.innerWidth <= 768 ? '0.875rem 0.875rem' : '0.9rem 1rem',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  fontSize: window.innerWidth <= 768 ? '16px' : '1rem', // 16px prevents zoom on iOS
  minHeight: window.innerWidth <= 768 ? '48px' : '44px', // Better touch target
  width: '100%',
  fontFamily: 'var(--font-body)',
  color: 'var(--text-dark)',
  backgroundColor: 'var(--text-light)',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  outline: 'none',
  WebkitAppearance: 'none', // Remove iOS styling
  boxSizing: 'border-box',
};

export default SignUp;