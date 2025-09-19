import './App.css'
import tantrumMomImage from './assets/tantrum-blonde-mom.png'
import happyPickupImage from './assets/happy-package-pickup.png'
import stacksCrazyImage from './assets/stacks-crazy.png'
import screenRecordingVideo from './assets/screen-record.MP4'

function LandingPage() {
  return (
    <main className="main-content">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-layer"></div>
        <h1>Let Haulzy take those for you</h1>
        <p className="subtitle">
          Haulzy handles your returns so you can focus on what matters most
        </p>
        <div className="hero-buttons" style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="cta-primary">Try it out</button>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '4rem 0', backgroundColor: 'white', margin: '2rem 0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ padding: '0 2rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', color: 'var(--secondary-color)' }}>How Haulzy Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            
            <div style={{ textAlign: 'center' }}>
              {/* Single Video - Centered */}
              <div style={{ marginBottom: '1.5rem' }}>
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
                    border: '3px solid var(--primary-color)'
                  }}
                />
              </div>
              
              <h3>Request</h3>
              <p>Open the app and tell us what you need - pickup, return, or hold service.</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div className="how-it-works-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
              <h3>We Handle It</h3>
              <p>Our trusted drivers pick up, deliver, or store your packages with care.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="how-it-works-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
              <h3>Stay Updated</h3>
              <p>Get real-time updates and photos so you always know where your packages are.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scenarios Section - Horizontal Grid with Wide Card Spacing */}
      <section style={{ padding: '4rem 0' }}>
        <div className="responsive-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '4rem', maxWidth: '1600px', margin: '0 auto' }}>
          
          <div className="scenario-card" style={{ 
            textAlign: 'center',
            padding: '3rem 2.5rem',
            margin: '0 1.5rem'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src={tantrumMomImage} 
                alt="Mom with screaming kids waiting in line with packages" 
                className="responsive-image"
                style={{ 
                  width: '250px',
                  height: 'auto',
                  borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }} 
              />
            </div>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', 
              marginBottom: '1.25rem',
              color: 'var(--secondary-color)'
            }}>
              No waiting in line
            </h2>
            <p style={{ 
              fontSize: '1rem', 
              lineHeight: '1.6', 
              marginBottom: '2rem',
              color: 'var(--accent-color)',
              maxWidth: '300px',
              margin: '0 auto 2rem auto'
            }}>
              Skip the post office queues and crowded shipping centers. We handle all your pickups and deliveries while you get on with your day.
            </p>
            <button className="scenario-cta">
              Schedule Pickup
            </button>
          </div>

          <div className="scenario-card" style={{ 
            textAlign: 'center',
            padding: '3rem 2.5rem',
            margin: '0 1.5rem'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src={stacksCrazyImage} 
                alt="Crazy stacks of packages piled up at the door" 
                className="responsive-image"
                style={{ 
                  width: '250px',
                  height: 'auto',
                  borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }} 
              />
            </div>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', 
              marginBottom: '1.25rem',
              color: 'var(--secondary-color)'
            }}>
              No stacks of boxes
            </h2>
            <p style={{ 
              fontSize: '1rem', 
              lineHeight: '1.6', 
              marginBottom: '2rem',
              color: 'var(--accent-color)',
              maxWidth: '300px',
              margin: '0 auto 2rem auto'
            }}>
              Don't let packages pile up at your door or clutter your home. We'll pick them up, store them safely, and deliver when you're ready.
            </p>
            <button className="scenario-cta">
              Arrange Storage
            </button>
          </div>

          <div className="scenario-card" style={{ 
            textAlign: 'center',
            padding: '3rem 2.5rem',
            margin: '0 1.5rem'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src={happyPickupImage} 
                alt="Happy customer with smooth package pickup experience" 
                className="responsive-image"
                style={{ 
                  width: '250px',
                  height: 'auto',
                  borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }} 
              />
            </div>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', 
              marginBottom: '1.25rem',
              color: 'var(--secondary-color)'
            }}>
              Effortless returns
            </h2>
            <p style={{ 
              fontSize: '1rem', 
              lineHeight: '1.6', 
              marginBottom: '2rem',
              color: 'var(--accent-color)',
              maxWidth: '300px',
              margin: '0 auto 2rem auto'
            }}>
              No trips to the store or waiting in line.
            </p>
            <button className="scenario-cta">
              Book Return
            </button>
          </div>

        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '4rem 0', backgroundColor: 'white', margin: '2rem 0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ padding: '0 2rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', color: 'var(--secondary-color)' }}>Simple, Transparent Pricing</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            
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
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$5.00</span>
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
              <button style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}>
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
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$8.00</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>/month</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>$96.00</span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>$86.40/year (10% off)</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>2 pickups per month</strong>
                </div>
                {/* <div style={{ color: 'var(--accent-color)' }}>
                  <strong>5 packages per pickup</strong>
                </div> */}
              </div>
              <button style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}>
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
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>$15.00</span>
                <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>/month</span>
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: '0.7' }}>$180.00</span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: '600' }}>$162.00/year (10% off)</span>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                  <strong>Unlimited pickups</strong>
                </div>
                {/* <div style={{ color: 'var(--accent-color)' }}>
                  <strong>8 packages per pickup</strong>
                </div> */}
              </div>
              <button style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}>
                Go Premium
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