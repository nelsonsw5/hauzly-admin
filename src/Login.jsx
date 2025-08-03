import './App.css'

function Login() {
  return (
    <main className="main-content">
      <section className="hero-section" style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <h1>Login</h1>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          <input 
            type="email" 
            placeholder="Email" 
            style={{ 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem'
            }} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            style={{ 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem'
            }} 
          />
          <button 
            type="submit" 
            style={{ 
              padding: '1rem', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
        </form>
        <p style={{ marginTop: '1rem', opacity: '0.8' }}>
          Don't have an account? <a href="/signup" style={{ color: 'white', textDecoration: 'underline' }}>Sign up</a>
        </p>
      </section>
    </main>
  )
}

export default Login 