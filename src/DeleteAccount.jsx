import './App.css';

function DeleteAccount() {
  const boxStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1.5rem',
    margin: '1.5rem 0',
    backgroundColor: 'white',
  };

  const headingStyle = {
    color: 'var(--text-dark)',
    fontFamily: 'var(--font-heading)',
    fontSize: '1.5rem',
    marginTop: 0,
    marginBottom: '1rem',
  };

  const listStyle = {
    marginLeft: '1.5rem',
    lineHeight: '1.8',
    color: 'var(--text-dark)',
    fontFamily: 'var(--font-body)',
  };

  return (
    <main className="main-content" style={{ padding: '2rem', minHeight: '100vh', backgroundColor: 'var(--background-light)' }}>
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <h1
          style={{
            color: 'var(--text-dark)',
            fontFamily: 'var(--font-heading)',
            fontSize: '2.5rem',
            marginBottom: '1rem',
            lineHeight: '1.25',
          }}
        >
          Request Account & Data Deletion
        </h1>
        
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6', fontSize: '1.1rem' }}>
          This page explains how to delete your <strong>Haulzy</strong> account and the
          types of data we delete or retain. <strong>Haulzy</strong> is published by
          <strong> Haulzy LLC</strong> (as shown on our Google Play listing).
        </p>

        <div style={boxStyle}>
          <h2 style={headingStyle}>How to Request Deletion</h2>
          <ol style={listStyle}>
            <li><strong>In the app (recommended):</strong> Open <em>Haulzy</em> → Profile/Settings → <em>Delete my account</em>, then follow the prompts.</li>
            <li><strong>Or via email:</strong> Send an email to <a href="mailto:info@usehaulzy.com" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>info@usehaulzy.com</a> with the subject "Delete my account" from the email tied to your account. Include your full name and phone number associated with your account.</li>
          </ol>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6' }}>
            <strong>Identity verification:</strong> If you email us, we may reply asking you to confirm via a verification code or to sign in once to confirm ownership.
          </p>
        </div>

        <div style={boxStyle}>
          <h2 style={headingStyle}>What We Delete</h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6' }}>
            Once your request is confirmed, we delete or irreversibly anonymize the following:
          </p>
          <ul style={listStyle}>
            <li><strong>Account profile:</strong> name, email, phone, profile photo.</li>
            <li><strong>App data:</strong> preferences, settings, saved addresses/locations.</li>
            <li><strong>Operational records:</strong> pickups/orders, items, in-app messages/notifications, device tokens.</li>
            <li><strong>Cloud assets you uploaded:</strong> photos/files associated with your account (e.g., package images).</li>
            <li><strong>Authentication:</strong> sign-in credentials and access tokens (e.g., Google/Firebase Auth linkage).</li>
          </ul>
        </div>

        <div style={boxStyle}>
          <h2 style={headingStyle}>What We May Retain (and Why)</h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6' }}>
            Some data must be retained for legal, security, or financial reasons. We retain the minimum necessary, for only as long as needed:
          </p>
          <ul style={listStyle}>
            <li><strong>Payment & billing records</strong> (e.g., Stripe receipts, invoices, charge/refund logs) for <strong>7 years</strong> to comply with tax, accounting, and audit obligations.</li>
            <li><strong>Fraud/abuse prevention logs</strong> (e.g., security and access logs) for up to <strong>180 days</strong>.</li>
            <li><strong>Customer support correspondence</strong> related to disputes/refunds for up to <strong>24 months</strong>.</li>
            <li><strong>Aggregated/anonymous analytics</strong> (which cannot identify you) may be retained indefinitely for product insights.</li>
            <li><strong>Backups</strong>: Your deleted data may persist in encrypted backups for up to <strong>90 days</strong> until those backups rotate.</li>
          </ul>
          <p style={{ fontFamily: 'var(--font-body)', color: '#6b7280', lineHeight: '1.6', fontSize: '0.95rem' }}>
            We do not use retained data to serve you after deletion, except where required by law or to resolve disputes, prevent abuse, or enforce terms.
          </p>
        </div>

        <div style={boxStyle}>
          <h2 style={headingStyle}>Timeline</h2>
          <ul style={listStyle}>
            <li><strong>Acknowledgment:</strong> We confirm your request within <strong>3 business days</strong>.</li>
            <li><strong>Deactivation:</strong> Your account is disabled within <strong>7 days</strong>.</li>
            <li><strong>Deletion:</strong> Primary deletion completes within <strong>30 days</strong> of verification.</li>
            <li><strong>Backups:</strong> Any residual copies in backups are purged within <strong>90 days</strong> by normal backup rotation.</li>
          </ul>
        </div>

        <div style={boxStyle}>
          <h2 style={headingStyle}>If You Have an Active Subscription</h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6' }}>
            Deleting your account <strong>does not automatically cancel</strong> third-party subscriptions billed via app stores. 
            Please cancel any active subscription via Google Play or the App Store first to avoid future charges. 
            We can help if you email <a href="mailto:info@usehaulzy.com" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>info@usehaulzy.com</a>.
          </p>
        </div>

        <div style={boxStyle}>
          <h2 style={headingStyle}>Contact</h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dark)', lineHeight: '1.6' }}>
            Email: <a href="mailto:info@usehaulzy.com" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>info@usehaulzy.com</a><br/>
            Phone: <a href="tel:8018001191" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>(801) 800-1191</a><br/>
            Postal: Springville, UT
          </p>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', color: '#6b7280', fontSize: '0.9rem', marginTop: '2rem' }}>
          Last updated: January 15, 2025
        </p>
      </div>
    </main>
  );
}

export default DeleteAccount;

