import './App.css'
import { useNavigate } from 'react-router-dom'
import tantrumMomImage from './assets/tantrum-blonde-mom.png'
import happyPickupImage from './assets/happy-package-pickup.png'
import stacksCrazyImage from './assets/stacks-crazy.png'
import screenRecordingVideo from './assets/schedule-pickup.MP4'
import packageReceivedVideo from './assets/package-received.mov'
import pickupImage from './assets/pickup-phone.png'

function LandingPage() {
  const navigate = useNavigate()

  const handleSignup = (plan) => {
    navigate('/signup', { state: { plan } })
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
            onClick={() => handleSignup('onetime')}
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
                Our trusted drivers pick up, transport and return your packages.
                with care.
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
                Get real-time updates and photos so you always know where your
                packages are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '4rem 0', backgroundColor: 'white', margin: '2rem 0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ padding: '0 2rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', color: 'var(--secondary-color)' }}>Simple, Transparent Pricing</h2>
          {/* Top row - Three main plans */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto', marginBottom: '3rem' }}>
            
            {/* One-Time Haul */}
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '2rem', 
              borderRadius: '12px', 
              border: '2px solid #e9ecef',
              textAlign: 'center',
              position: 'relative'
            }}>
              <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>One-Time Haul</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$4.99</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>per haul</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>1 pickup per month</strong>
                </div>
                {/* <div style={{ color: 'var(--accent-color)' }}>
                  <strong>3 packages per pickup</strong>
                </div> */}
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
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
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
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$7.99</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>/month</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>$96.00</span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>$86.99/year</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>2 pickups per month</strong>
                </div>
                {/* <div style={{ color: 'var(--accent-color)' }}>
                  <strong>5 packages per pickup</strong>
                </div> */}
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
              position: 'relative'
            }}>
              <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Premium</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$14.99</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>/month</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>$180.00</span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>$161.99/year</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>Unlimited pickups</strong>
                </div>
                {/* <div style={{ color: 'var(--accent-color)' }}>
                  <strong>8 packages per pickup</strong>
                </div> */}
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
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$154.99</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>/year</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>*only for yearly subscriptions</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>Up to 6 people</strong>
                </div>
                <div style={{ color: 'var(--accent-color)' }}>
                  <strong>Unlimited pickups</strong>
                </div>
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
        <h2>Ready to simplify your  returns?</h2>
        <p style={{ marginBottom: '2rem', opacity: '0.9' }}>
        </p>
        <button className="cta-primary" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
          Claim your free pickup
        </button>
        {/* <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: '0.7' }}>
          Up to 3 boxes free
        </p> */}
      </section>
    </main>
  )
}

export default LandingPage 