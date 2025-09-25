import './App.css'

function Download() {
  return (
    <main className="main-content">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-layer"></div>
        <h1>Download Haulzy</h1>
        <p className="subtitle">
          No more waiting in line. Get package returns picked up right from your doorstep.
        </p>
        
        {/* Download Button */}
        <div
          style={{
            marginTop: '3rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <a
            href="https://apps.apple.com/us/app/haulzy/id6749022857"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
            }}
          >
            <img
              src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
              alt="Download on the App Store"
              style={{
                height: '60px',
                width: 'auto',
                transition: 'transform 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            />
          </a>
        </div>
        
        {/* App Features */}
        <div
          style={{
            marginTop: window.innerWidth <= 768 ? '2rem' : '4rem',
            maxWidth: '800px',
            margin: window.innerWidth <= 768 ? '2rem auto 0' : '4rem auto 0',
            padding: window.innerWidth <= 768 ? '0 1rem' : '0 2rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
              gap: window.innerWidth <= 768 ? '1.5rem' : '2rem',
              textAlign: 'center',
            }}
          >
            <div>
              <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>📦 Easy Scheduling</h3>
              <p style={{ color: 'white', opacity: 0.9 }}>
                Schedule pickups in seconds. Upload return labels or QR codes directly in the app.
              </p>
            </div>
            <div>
              <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>🚚 Doorstep Service</h3>
              <p style={{ color: 'white', opacity: 0.9 }}>
                No more waiting in line. We pick up your packages right from your doorstep.
              </p>
            </div>
            <div>
              <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>📸 Photo Confirmation</h3>
              <p style={{ color: 'white', opacity: 0.9 }}>
                Get real-time updates and photo confirmation when your packages are picked up.
              </p>
            </div>
          </div>
        </div>
        
        {/* App Info */}
        <div
          style={{
            marginTop: window.innerWidth <= 768 ? '2rem' : '4rem',
            padding: window.innerWidth <= 768 ? '1.5rem' : '2rem',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            maxWidth: '600px',
            margin: window.innerWidth <= 768 ? '2rem auto 0' : '4rem auto 0',
            textAlign: 'center',
          }}
        >
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Available on iPhone</h3>
          <p style={{ color: 'white', opacity: 0.9, marginBottom: '1rem' }}>
            Requires iOS 15.1 or later • Free Download • 21.7 MB
          </p>
          <p style={{ color: 'white', opacity: 0.8, fontSize: '0.9rem' }}>
            Perfect for busy parents, remote workers, and anyone who values their time.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Download
