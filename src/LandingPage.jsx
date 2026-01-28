import './App.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import pickupImage from './assets/pickup-phone.png'
import screenRecordingVideo from './assets/schedule-pickup.MP4'
import packageReceivedVideo from './assets/package-received.mov'

function LandingPage() {
  const navigate = useNavigate()

  // Toggle to show/hide Family plan - set to false to hide it
  const showFamilyPlan = false

  // State for price data
  const [priceData, setPriceData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch price data from Firestore
  useEffect(() => {
    async function fetchPriceData() {
      try {
        const settingsRef = doc(db, 'settings', 'products')
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          console.log('Landing page - Price data loaded:', data)
          setPriceData(data)
        } else {
          console.error('No products document found')
        }
      } catch (err) {
        console.error('Error fetching price data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPriceData()
  }, [])

  // Extract plan data
  const subscriptionPlans = priceData?.subscriptionPlans || {}
  const oneTimePlan = priceData?.oneTimePlan || {}
  const basicPlan = subscriptionPlans.basic || {}
  const premiumPlan = subscriptionPlans.premium || {}
  const familyPlan = subscriptionPlans.family || {}

  const handleSignup = (plan) => {
    navigate('/signup', { state: { plan } })
  }

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#FFFCF5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '1.5rem', 
            color: 'var(--primary-color)',
            marginBottom: '1rem'
          }}>
            Loading...
          </div>
          <p style={{ color: 'var(--accent-color)' }}>Getting pricing information</p>
        </div>
      </div>
    )
  }

  return (
    <main className="main-content">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-layer"></div>
        <h1>Let Haulzy take those for you</h1>
        <p className="subtitle">
          Haulzy handles your returns so you can focus on what matters most
        </p>
        <div
          className="hero-buttons"
          style={{
            marginTop: '2rem',
            display: 'flex',
            gap: '2rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="cta-primary"
            onClick={() => window.location.href = 'https://usehaulzy.com/free'}
          >
            Try it out
          </button>
        </div>
      </section>

      {/* How It Works */}
      <section
        style={{
          padding: '4rem 0',
          backgroundColor: 'white',
          margin: '2rem 0',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ padding: '0 2rem' }}>
          <h2
            style={{
              textAlign: 'center',
              marginBottom: '3rem',
              color: 'var(--secondary-color)',
            }}
          >
            How Haulzy Works
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Single Video - Centered */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <video
                  src={screenRecordingVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: '280px',
                    height: 'auto',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    border: '3px solid var(--primary-color)',
                  }}
                />
              </div>

              <h3>Request</h3>
              <p>
                Open the app and tell us where, when and what you need.
              </p>
            </div>

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <img
                  src={pickupImage}
                  alt="Package pickup service"
                  style={{
                    width: '280px',
                    height: 'auto',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    border: '3px solid var(--primary-color)',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <h3>We Handle It</h3>
              <p>
                Our trusted drivers pick up, transport and return your packages with care.
              </p>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <video
                  src={packageReceivedVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: '280px',
                    height: 'auto',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    border: '3px solid var(--primary-color)',
                  }}
                />
              </div>
              <h3>Stay Updated</h3>
              <p>
                Get real-time updates and photos so you always know where your packages are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Companies Section */}
      {/* <section style={{ 
        padding: '4rem 0', 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0d9488 50%, #14b8a6 100%)',
        margin: '2rem 0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(20, 184, 166, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: '0.5rem', 
            color: 'white',
            padding: '0 2rem',
            fontSize: '2.2rem',
            fontWeight: '700',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
          }}>
            
          </h2>
          <p style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '3rem',
            fontSize: '1.1rem',
            fontWeight: '400'
          }}>
            No matter where you're shopping, haulzy can handle it.
          </p>
          
          <div style={{
            overflow: 'hidden',
            position: 'relative',
            padding: '2rem 0',
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
          }}>
            <style>
              {`
                @keyframes scroll {
                  0% {
                    transform: translateX(0);
                  }
                  100% {
                    transform: translateX(-50%);
                  }
                }
                
                .company-scroll {
                  display: flex;
                  animation: scroll 25s linear infinite;
                  gap: 5rem;
                }
                
                .company-scroll:hover {
                  animation-play-state: paused;
                }
              `}
            </style>
            <div className="company-scroll">
              {/* First set */}
              {/* <div style={{ display: 'flex', gap: '5rem', alignItems: 'center' }}>
                <img src="https://logo.clearbit.com/amazon.com" alt="Amazon logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/nike/000000" alt="Nike logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/adidas/000000" alt="Adidas logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/hoka.com" alt="Hoka logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/lululemon.com" alt="Lululemon logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/walmart.com" alt="Walmart logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/target/000000" alt="Target logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/costco.com" alt="Costco logo" style={{height: '40px'}} />
              </div>
              {/* Duplicate set for seamless loop */}
              {/* <div style={{ display: 'flex', gap: '5rem', alignItems: 'center' }}>
                <img src="https://logo.clearbit.com/amazon.com" alt="Amazon logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/nike/000000" alt="Nike logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/adidas/000000" alt="Adidas logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/hoka.com" alt="Hoka logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/lululemon.com" alt="Lululemon logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/walmart/000000" alt="Walmart logo" style={{height: '40px'}} />
                <img src="https://cdn.simpleicons.org/target/000000" alt="Target logo" style={{height: '40px'}} />
                <img src="https://logo.clearbit.com/costco.com" alt="Costco logo" style={{height: '40px'}} />
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '4rem 2rem', backgroundColor: 'white', margin: '2rem auto', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', maxWidth: '1400px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', color: 'var(--secondary-color)' }}>Simple, Transparent Pricing</h2>
          {/* Top row - Three main plans */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', justifyItems: 'center', marginBottom: '3rem' }}>
            {/* Pay per Haul */}
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '2rem', 
              borderRadius: '12px', 
              border: '2px solid #e9ecef',
              textAlign: 'center',
              position: 'relative',
              width: '100%',
              maxWidth: '350px'
            }}>
              <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Pay per Haul</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{oneTimePlan.priceMonthly || '$4.99'}</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>{oneTimePlan.periodMonthly || 'per haul'}</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                {oneTimePlan.features && oneTimePlan.features.length > 0 ? (
                  <div style={{ 
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      marginBottom: '0.5rem',
                      fontWeight: 'bold',
                      color: '#6b7280',
                      fontSize: '1rem'
                    }}>
                      Pay Per Pickup
                    </div>
                    {oneTimePlan.features.slice(0, 2).map((feature, idx) => (
                      <div key={idx} style={{ 
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        color: '#6b7280',
                        fontSize: '1rem',
                        lineHeight: '1.5'
                      }}>
                        <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem', flexShrink: 0, lineHeight: '1.5' }}>✓</span>
                        <span style={{ textAlign: 'left' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginBottom: '0.5rem', color: '#6b7280' }}>
                    <strong>Purchase whenever you need a pickup</strong>
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleSignup('onetime')}
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Get Started
              </button>
            </div>
            {/* Basic */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '12px', 
              border: '2px solid var(--primary-color)',
              textAlign: 'center',
              position: 'relative',
              transform: 'scale(1.05)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: '350px'
            }}>
              <div style={{ 
                position: 'absolute', 
                top: '-12px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>
                Most Popular
              </div>
              <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Basic</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{basicPlan.priceMonthly || '$7.99'}</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>{basicPlan.periodMonthly || '/month'}</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>
                  ${(parseFloat(basicPlan.priceMonthly?.replace('$', '') || '7.99') * 12).toFixed(2)}
                </span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>
                  {basicPlan.priceYearly || '$86.99'}/year
                </span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                {basicPlan.features && basicPlan.features.length > 0 ? (
                  <div style={{ 
                    textAlign: 'center'
                  }}>
                    {basicPlan.features
                      .filter(f => {
                        const isPickups = f.toLowerCase().includes('pickups')
                        const isUps = f.toLowerCase().includes('ups')
                        return isPickups || isUps
                      })
                      .sort((a, b) => {
                        // Sort: pickups first, then online returns
                        const aIsPickup = a.toLowerCase().includes('pickup')
                        const bIsPickup = b.toLowerCase().includes('pickup')
                        if (aIsPickup && !bIsPickup) return -1
                        if (!aIsPickup && bIsPickup) return 1
                        return 0
                      })
                      .slice(0, 2)
                      .map((feature, idx) => {
                        const isPickupsFeature = feature.toLowerCase().includes('2 pickups per month') || 
                                                 feature.toLowerCase().includes('2 pickup')
                        return (
                          <div key={idx} style={{ 
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: '#6b7280',
                            fontSize: '1rem',
                            lineHeight: '1.5'
                          }}>
                            {isPickupsFeature ? (
                              <span style={{ fontWeight: 'bold' }}>{feature}</span>
                            ) : (
                              <>
                                <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem', flexShrink: 0, lineHeight: '1.5' }}>✓</span>
                                <span style={{ textAlign: 'left' }}>{feature}</span>
                              </>
                            )}
                          </div>
                        )
                      })
                    }
                  </div>
                ) : (
                  <div style={{ marginBottom: '0.5rem', color: '#6b7280' }}>
                    <strong>2 pickups per month</strong>
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleSignup('basic')}
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Choose Basic
              </button>
            </div>
            {/* Premium */}
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '2rem', 
              borderRadius: '12px', 
              border: '2px solid #e9ecef',
              textAlign: 'center',
              position: 'relative',
              width: '100%',
              maxWidth: '350px'
            }}>
              <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Premium</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{premiumPlan.priceMonthly || '$14.99'}</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>{premiumPlan.periodMonthly || '/month'}</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>
                  ${(parseFloat(premiumPlan.priceMonthly?.replace('$', '') || '14.99') * 12).toFixed(2)}
                </span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>
                  {premiumPlan.priceYearly || '$161.99'}/year
                </span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                {premiumPlan.features && premiumPlan.features.length > 0 ? (
                  <>
                    {/* Show unlimited pickups feature prominently if it exists */}
                    {premiumPlan.features.some(f => 
                      f.toLowerCase().includes('unlimited pickup') || 
                      f.toLowerCase().includes('unlimited haul')
                    ) && (
                      <div style={{ 
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        color: '#6b7280',
                        fontSize: '1rem'
                      }}>
                        {premiumPlan.features
                          .filter(f => 
                            f.toLowerCase().includes('unlimited pickup') || 
                            f.toLowerCase().includes('unlimited haul')
                          )
                          .slice(0, 1)
                          .map((feature, idx) => (
                            <span key={idx} style={{ fontWeight: 'bold' }}>{feature}</span>
                          ))
                        }
                      </div>
                    )}
                    {/* Show all other premium features */}
                    <div style={{ 
                      textAlign: 'center'
                    }}>
                      {premiumPlan.features
                        .filter(f => 
                          !f.toLowerCase().includes('unlimited pickup') && 
                          !f.toLowerCase().includes('unlimited haul')
                        )
                        .map((feature, idx) => (
                          <div key={idx} style={{ 
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: '#6b7280',
                            fontSize: '1rem',
                            lineHeight: '1.5'
                          }}>
                            <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem', flexShrink: 0, lineHeight: '1.5' }}>✓</span>
                            <span style={{ textAlign: 'left' }}>{feature}</span>
                          </div>
                        ))
                      }
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ 
                      marginBottom: '1rem', 
                      color: 'var(--accent-color)', 
                      textAlign: 'center',
                      fontSize: '1.05rem'
                    }}>
                      <strong>Unlimited pickups</strong>
                    </div>
                    <div style={{ 
                      textAlign: 'left',
                      padding: '0 0.5rem'
                    }}>
                      <div style={{ 
                        marginBottom: '0.65rem', 
                        color: 'var(--accent-color)',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                        <span>Hassle-free Costco returns</span>
                      </div>
                      <div style={{ 
                        marginBottom: '0.65rem', 
                        color: 'var(--accent-color)',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                        <span>Sell ineligible items on FB Marketplace</span>
                      </div>
                      <div style={{ 
                        marginBottom: '0.65rem', 
                        color: 'var(--accent-color)',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                        <span>Free packaging materials provided</span>
                      </div>
                      <div style={{ 
                        marginBottom: '0.65rem', 
                        color: 'var(--accent-color)',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                        <span>Print and attach your return labels</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={() => handleSignup('premium')}
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Go Premium
              </button>
            </div>
          </div>
          {/* Bottom row - Family plan centered */}
          {showFamilyPlan && (
            <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '1200px', margin: '0 auto' }}>
              {/* Family */}
              <div style={{ 
                backgroundColor: 'white', 
                padding: '2rem', 
                borderRadius: '12px', 
                border: '2px solid var(--secondary-color)',
                textAlign: 'center',
                position: 'relative',
                maxWidth: '320px',
                width: '100%',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '-12px', 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--secondary-color)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  Best Value
                </div>
                <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Family</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{familyPlan.priceYearly || '$154.99'}</span>
                  <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>{familyPlan.periodYearly || '/year'}</span>
                </div>
                <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>*only for yearly subscriptions</span>
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  {familyPlan.features && familyPlan.features.length > 0 ? (
                    <div style={{ 
                      textAlign: 'center',
                      color: 'var(--accent-color)'
                    }}>
                      {familyPlan.features
                        .filter(f => 
                          f.toLowerCase().includes('people') || 
                          f.toLowerCase().includes('family') ||
                          f.toLowerCase().includes('unlimited')
                        )
                        .slice(0, 2)
                        .map((feature, idx) => (
                          <div key={idx} style={{ marginBottom: '0.5rem' }}>
                            <strong>{feature}</strong>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                        <strong>Up to 6 people</strong>
                      </div>
                      <div style={{ color: 'var(--accent-color)' }}>
                        <strong>Unlimited pickups</strong>
                      </div>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => handleSignup('family')}
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Choose Family
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: '4rem 0', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '2rem', color: 'var(--secondary-color)' }}>Committed to you</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        </div>
        <p style={{ color: 'var(--accent-color)', fontStyle: 'italic', maxWidth: '600px', margin: '0 auto' }}>
          "Haulzy saved my sanity. No more waiting around for packages or dealing with return hassles. I can't imagine life without it!"
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--accent-color)' }}>- Someone very soon</p>
      </section>

      {/* Final CTA */}
      <section className="hero-section" style={{ margin: '2rem 0' }}>
        <h2>Ready to simplify your returns?</h2>
        <p style={{ marginBottom: '2rem', opacity: '0.9' }}>
        </p>
        <button 
          className="cta-primary" 
          style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}
          onClick={() => window.location.href = 'https://usehaulzy.com/free'}
        >
          Book your first haul
        </button>
      </section>
    </main>
  )
}

export default LandingPage