import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { fetchSignInMethodsForEmail } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'

const subscriptionPlans = {
  basic: {
    name: 'Basic',
    priceMonthly: '$7.99',
    periodMonthly: '/month',
    priceYearly: '$86.99',
    periodYearly: '/year',
    yearlyDiscount: '10% off',
    features: ['2 pickups per month'],
  },
  premium: {
    name: 'Premium',
    priceMonthly: '$14.99',
    periodMonthly: '/month',
    priceYearly: '$161.99',
    periodYearly: '/year',
    yearlyDiscount: '10% off',
    features: ['Unlimited pickups'],
  },
  family: {
    name: 'Family',
    priceYearly: '$154.99',
    periodYearly: '/year',
    features: ['Up to 6 people', 'Unlimited pickups'],
  },
}

const oneTimePlan = {
  name: 'One-Time Haul',
  priceMonthly: '$4.99',
  periodMonthly: 'per haul',
  features: ['Pay per haul'],
}

const functions = getFunctions()
const purchaseSingleHaul = httpsCallable(functions, 'purchase_single_haul')
const purchaseSubscription = httpsCallable(functions, 'purchase_subscription')

function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [selectedPlan, setSelectedPlan] = useState(location.state?.selectedPlan || 'basic')
  const [planType, setPlanType] = useState(location.state?.selectedPlan === 'onetime' ? 'onetime' : 'subscription') // 'subscription' | 'onetime'
  const [billingCycle, setBillingCycle] = useState('yearly') // 'monthly' | 'yearly'

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
    if (planType === 'onetime') {
      return { amount: oneTimePlan.priceMonthly, period: oneTimePlan.periodMonthly }
    }
    const plan = subscriptionPlans[planId]
    if (billingCycle === 'yearly' && plan.priceYearly) {
      return { amount: plan.priceYearly, period: plan.periodYearly }
    }
    return { amount: plan.priceMonthly, period: plan.periodMonthly }
  }

  function getPriceId(planId, billingCycle) {
    // Replace these with your actual Stripe Price IDs
    const priceIds = {
      basic: {
        monthly: 'price_basic_monthly_id',
        yearly: 'price_basic_yearly_id'
      },
      premium: {
        monthly: 'price_premium_monthly_id', 
        yearly: 'price_premium_yearly_id'
      },
      family: {
        yearly: 'price_family_yearly_id'
      }
    }
    
    return priceIds[planId]?.[billingCycle]
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
  
    console.log('SignUp: handleSubmit started');
    console.log('SignUp: Form data:', {
      firstName, lastName, email, phoneNumber, streetAddress, city, state, zip,
      selectedPlan, planType, billingCycle
    });
  
    if (password !== confirmPassword) {
      console.log('SignUp: Password mismatch error');
      setError('Passwords do not match');
      return;
    }
  
    setSubmitting(true);
  
    try {
      // 1) Check if user exists
      console.log('SignUp: Checking if user exists for email:', email);
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      console.log('SignUp: Sign in methods found:', signInMethods);
      if (signInMethods.length > 0) {
        console.log('SignUp: User already exists');
        setError('An account with this email already exists. Please sign in instead.');
        return;
      }
  
      // 2) Prepare payment data
      console.log('SignUp: Preparing payment data');
      const displayPrice = getDisplayPrice(selectedPlan);
      const currentPlan = planType === 'onetime' ? oneTimePlan : subscriptionPlans[selectedPlan];
      const actualBillingCycle = planType === 'onetime' ? 'onetime' : billingCycle;
  
      console.log('SignUp: Display price:', displayPrice);
      console.log('SignUp: Current plan:', currentPlan);
      console.log('SignUp: Actual billing cycle:', actualBillingCycle);
  
      const customerData = {
        email,
        name: `${firstName} ${lastName}`,
        phone: phoneNumber.replace(/\D/g, ''),
        address: {
          line1: streetAddress, city, state, postal_code: zip, country: 'US'
        }
      };
  
      const planData = {
        type: planType === 'onetime' ? 'onetime' : selectedPlan,
        name: currentPlan.name,
        billingCycle: actualBillingCycle,
        price: displayPrice.amount,
        period: displayPrice.period,
        features: currentPlan.features,
        yearlyDiscount: currentPlan.yearlyDiscount,
      };
  
      console.log('SignUp: Customer data:', customerData);
      console.log('SignUp: Plan data:', planData);
  
      // 3) Create Checkout Session via your backend
      let paymentResult;
      if (planType === 'onetime') {
        console.log('SignUp: Processing one-time payment (Checkout)');
        paymentResult = await purchaseSingleHaul({
          customer: customerData,
          plan: planData,
          amount: Math.round(parseFloat(displayPrice.amount.replace('$', '')) * 100),
        });
      } else {
        console.log('SignUp: Processing subscription payment (Checkout)');
        paymentResult = await purchaseSubscription({
          customer: customerData,
          plan: planData,
          priceId: getPriceId(selectedPlan, actualBillingCycle),
          billingCycle: actualBillingCycle,
        });
      }
  
      console.log('SignUp: Payment result:', paymentResult);
  
      // 4) Handle Checkout redirect
      const url = paymentResult?.data?.url;
      const sessionId = paymentResult?.data?.sessionId;
  
      if (url) {
        // Save minimal data you’ll need after returning from success page
        localStorage.setItem('postCheckoutSignup', JSON.stringify({
          firstName, lastName, email, phoneNumber, streetAddress, city, state, zip,
          receiveTextUpdates, planData, password,
        }));
        console.log('SignUp: Redirecting to Stripe Checkout via URL');
        window.location.href = url;
        return; // stop here
      }
  
      // (Optional) Use stripe-js if only sessionId is returned
      if (sessionId) {
        // Ensure publishable key MODE matches the session (pk_live w/ cs_live; pk_test w/ cs_test)
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('Checkout redirect error:', error.message);
          setError(error.message || 'Unable to redirect to checkout. Please try again.');
          return;
        }
        return; // navigation likely occurred
      }
  
      // If we got here, backend didn’t return a usable Checkout session
      console.error('SignUp: No Checkout URL or sessionId returned');
      setError('We couldn’t start checkout. Please try again.');
  
    } catch (err) {
      console.error('SignUp: Error during signup process:', err);
      console.error('SignUp: Error stack:', err.stack);
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      console.log('SignUp: Setting submitting to false');
      setSubmitting(false);
    }
  }
  

  return (
    <main className="main-content" style={{ padding: '0.5rem', minHeight: '100vh' }}>
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
                  .filter(([planId]) => billingCycle === 'yearly' || planId !== 'family')
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
          <h2 style={{ marginTop: 0, color: 'var(--text-dark)', fontFamily: 'var(--font-heading)' }}>Create Your Account</h2>

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
}

export default SignUp