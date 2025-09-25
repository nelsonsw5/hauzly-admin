import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()
const verifyCheckoutSession = httpsCallable(functions, 'verify_checkout_session')

function SuccessPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const completeSignup = async () => {
      try {
        // Get session ID from URL
        const params = new URLSearchParams(window.location.search)
        const sessionId = params.get('session_id')
        if (!sessionId) {
          setError('Missing session ID')
          return
        }

        // Verify checkout session
        const verify = await verifyCheckoutSession({ sessionId })
        if (verify.data.status !== 'complete') {
          setError('Payment not completed')
          return
        }

        // Get cached signup data
        const raw = localStorage.getItem('postCheckoutSignup')
        if (!raw) {
          setError('Missing signup information')
          return
        }
        const signupData = JSON.parse(raw)

        // Create Firebase user
        const cred = await createUserWithEmailAndPassword(
          auth, 
          signupData.email, 
          signupData.password
        )
        await updateProfile(cred.user, { 
          displayName: `${signupData.firstName} ${signupData.lastName}` 
        })

        // Save to Firestore
        const plan = {
          ...signupData.planData,
          startDate: new Date().toISOString(),
          status: 'active',
          stripeCustomerId: verify.data.customer,
          stripeSubscriptionId: verify.data.subscription || null,
          stripePaymentIntentId: verify.data.payment_intent || null,
        }

        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          firstName: signupData.firstName,
          lastName: signupData.lastName,
          phoneNumber: signupData.phoneNumber.replace(/\D/g, ''),
          type: 'customer',
          isAdmin: false,
          approved: true,
          streetAddress: signupData.streetAddress,
          city: signupData.city,
          state: signupData.state,
          zip: signupData.zip,
          receiveTextUpdates: signupData.receiveTextUpdates,
          plan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

        // Cleanup and redirect
        localStorage.removeItem('postCheckoutSignup')
        navigate('/dashboard')

      } catch (err) {
        console.error('Error completing signup:', err)
        setError(err.message || 'Failed to complete signup')
      }
    }

    completeSignup()
  }, [navigate])

  if (error) {
    return (
      <main className="main-content" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Error</h2>
        <p style={{ color: '#dc2626', marginBottom: '2rem' }}>{error}</p>
        <button 
          onClick={() => navigate('/signup')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-color)',
            color: 'var(--text-light)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </main>
    )
  }

  return (
    <main className="main-content" style={{ 
      padding: '2rem', 
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <h2 style={{ color: 'var(--text-dark)' }}>Completing your signup...</h2>
      <p style={{ color: 'var(--text-dark)', opacity: 0.8 }}>Please wait while we set up your account.</p>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--primary-color)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </main>
  )
}

export default SuccessPage
