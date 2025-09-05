import './App.css'

function PrivacyPolicy() {
  return (
    <main className="main-content">
      <section className="hero-section" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '900px' }}>
        <h1>Privacy Policy</h1>
        <div style={{ backgroundColor: 'white', color: 'var(--secondary-color)', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', marginTop: '1.5rem' }}>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>Last updated: {new Date().toLocaleDateString()}</p>
          <p style={{ marginBottom: '1rem' }}>
            Haulzy respects your privacy. This policy explains what information we collect, why we collect it, and how we use it.
          </p>
          <h3>Information We Collect</h3>
          <p style={{ marginBottom: '1rem' }}>
            We collect information you provide directly to us, such as account details, pickup and delivery information, and any communications with support.
          </p>
          <h3>How We Use Information</h3>
          <p style={{ marginBottom: '1rem' }}>
            We use your information to operate, maintain, and improve our services, including scheduling pickups, coordinating routes, and providing customer support.
          </p>
          <h3>Sharing</h3>
          <p style={{ marginBottom: '1rem' }}>
            We do not sell your personal information. We may share information with service providers who assist in operating our services, subject to appropriate safeguards.
          </p>
          <h3>Data Security</h3>
          <p style={{ marginBottom: '1rem' }}>
            We implement reasonable security measures to protect your data. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </p>
          <h3>Your Choices</h3>
          <p style={{ marginBottom: '1rem' }}>
            You may access, update, or delete certain information within your account. For other requests, please contact support.
          </p>
          <h3>Contact Us</h3>
          <p>If you have questions about this policy, contact us at info@usehaulzy.com.</p>
        </div>
      </section>
    </main>
  )
}

export default PrivacyPolicy

