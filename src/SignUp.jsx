import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'

function SignUp() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (fullName) {
        await updateProfile(cred.user, { displayName: fullName })
      }
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: fullName || cred.user.displayName || '',
        role: 'user', // Default role
        createdAt: new Date(),
        lastLoginAt: new Date()
      })
      
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="main-content">
      <section className="hero-section form-container" style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <h1>Sign Up</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          <input 
            type="text" 
            placeholder="Full Name" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
          <input 
            type="password" 
            placeholder="Confirm Password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {submitting ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', opacity: '0.8' }}>
          Already have an account? <Link to="/login" style={{ color: 'white', textDecoration: 'underline' }}>Login</Link>
        </p>
      </section>
    </main>
  )
}

export default SignUp