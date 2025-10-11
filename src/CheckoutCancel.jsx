import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { auth } from './firebase';
import './App.css';

function CheckoutCancel() {
  const navigate = useNavigate();

  // Automatically redirect to dashboard after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'var(--background-light)',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 45, 71, 0.1)',
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            background: '#6B7280', // Using a neutral color for cancel
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <span style={{ fontSize: '40px', color: 'white' }}>←</span>
        </div>

        <h1
          style={{
            color: 'var(--text-dark)',
            fontFamily: 'var(--font-heading)',
            fontSize: '2.5rem',
            margin: '0 0 1rem',
          }}
        >
          Checkout Cancelled
        </h1>
        
        <p
          style={{
            color: 'var(--text-dark)',
            fontSize: '1.1rem',
            opacity: 0.8,
            margin: '0 0 2rem',
          }}
        >
          No worries! You can try again whenever you're ready.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 191, 179, 0.2)',
            }}
          >
            Try Again
          </button>

          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              color: 'var(--text-dark)',
              border: '2px solid var(--border-color)',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutCancel;
