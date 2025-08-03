import './App.css'

function Dashboard() {
  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--accent-color)' }}>Welcome to your Haulzy admin dashboard</p>
      </section>

      <section className="features-section">
        <div className="feature-card">
          <h3>Active Pickups</h3>
          <p style={{ fontSize: '2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>24</p>
          <p>Pickups scheduled for today</p>
        </div>
        <div className="feature-card">
          <h3>Pending Returns</h3>
          <p style={{ fontSize: '2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>12</p>
          <p>Returns awaiting processing</p>
        </div>
        <div className="feature-card">
          <h3>Completed Today</h3>
          <p style={{ fontSize: '2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>18</p>
          <p>Successfully completed deliveries</p>
        </div>
      </section>

      <section style={{ marginTop: '3rem' }}>
        <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Recent Activity</h2>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <p style={{ color: 'var(--accent-color)' }}>Recent pickup and return activities will be displayed here...</p>
        </div>
      </section>
    </main>
  )
}

export default Dashboard 