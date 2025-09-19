import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      
      // Update last login time
      try {
        await updateDoc(doc(db, 'users', cred.user.uid), {
          lastLoginAt: new Date()
        })
      } catch (updateError) {
        console.log('Could not update last login time:', updateError)
        // Don't fail login if this update fails
      }
      
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="main-content">
      <section className="hero-section form-container" style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <h1>Login</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            style={{ 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem',
              minHeight: '44px',
              width: '100%'
            }} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            style={{ 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem',
              minHeight: '44px',
              width: '100%'
            }} 
          />
          {error && (
            <div style={{ color: 'salmon', fontSize: '0.9rem' }}>{error}</div>
          )}
          <button 
            type="submit" 
            disabled={submitting}
            className="form-button"
            style={{ 
              padding: '1rem', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
              opacity: submitting ? 0.7 : 1,
              minHeight: '44px',
              width: '100%'
            }}
          >
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', opacity: '0.8' }}>
          Don't have an account? <Link to="/signup" style={{ color: 'white', textDecoration: 'underline' }}>Sign up</Link>
        </p>
      </section>
    </main>
  )
}

export default Login