import './App.css'

function Terms() {
  return (
    <main className="main-content">
      <section className="hero-section" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '900px' }}>
        <h1>Terms & Conditions</h1>
        <div style={{ backgroundColor: 'white', color: 'var(--secondary-color)', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', marginTop: '1.5rem' }}>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>Last updated: {new Date().toLocaleDateString()}</p>
          <h3>Acceptance of Terms</h3>
          <p style={{ marginBottom: '1rem' }}>
            By accessing or using Haulzy, you agree to be bound by these Terms & Conditions. If you do not agree, you may not use the service.
          </p>
          <h3>Use of Service</h3>
          <p style={{ marginBottom: '1rem' }}>
            You agree to use the service only for lawful purposes and in accordance with these terms. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
          </p>
          <h3>Accounts</h3>
          <p style={{ marginBottom: '1rem' }}>
            You must provide accurate, current, and complete information when creating an account and keep your information up to date.
          </p>
          <h3>Limitation of Liability</h3>
          <p style={{ marginBottom: '1rem' }}>
            To the maximum extent permitted by law, Haulzy shall not be liable for any indirect, incidental, special, consequential or punitive damages.
          </p>
          <h3>Termination</h3>
          <p style={{ marginBottom: '1rem' }}>
            We may suspend or terminate access to the service immediately, without prior notice or liability, for any reason whatsoever.
          </p>
          <h3>Changes to Terms</h3>
          <p style={{ marginBottom: '1rem' }}>
            We may modify these Terms & Conditions from time to time. Continued use of the service after changes take effect constitutes acceptance of the revised terms.
          </p>
          <h3>Contact Us</h3>
          <p>If you have any questions about these Terms, contact us at info@usehaulzy.com.</p>
        </div>
      </section>
    </main>
  )
}

export default Terms

