import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './AuthContext'

function Purchase() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState(location.state?.plan || 'basic')

  useEffect(() => {
    // If user is not logged in, redirect to signup with return path
    if (!user) {
      navigate('/signup', { 
        state: { 
          returnPath: '/purchase',
          selectedPlan: selectedPlan 
        } 
      })
    }
  }, [user, navigate, selectedPlan])

  const plans = {
    onetime: {
      name: 'One-Time Haul',
      price: '$5.00',
      period: 'per haul',
      features: [
        '1 pickup per month'
      ]
    },
    basic: {
      name: 'Basic',
      price: '$8.00',
      period: '/month',
      yearlyPrice: '$86.40/year',
      yearlyDiscount: '10% off',
      features: [
        '2 pickups per month'
      ]
    },
    premium: {
      name: 'Premium',
      price: '$15.00',
      period: '/month',
      yearlyPrice: '$162.00/year',
      yearlyDiscount: '10% off',
      features: [
        'Unlimited pickups'
      ]
    }
  }

  const handlePurchase = (plan) => {
    // TODO: Implement payment processing
    console.log('Processing purchase for plan:', plan)
  }

  return (
    <div className="purchase-page" style={{ 
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ 
        textAlign: 'center',
        color: 'var(--secondary-color)',
        marginBottom: '2rem'
      }}>
        Complete Your Purchase
      </h1>

      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>
            Selected Plan: {plans[selectedPlan].name}
          </h2>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {plans[selectedPlan].price}
                <span style={{ fontSize: '1rem', color: 'var(--accent-color)', marginLeft: '0.5rem' }}>
                  {plans[selectedPlan].period}
                </span>
              </p>
              {plans[selectedPlan].yearlyPrice && (
                <p style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                  <span style={{ textDecoration: 'line-through', opacity: '0.7', marginRight: '0.5rem' }}>
                    {parseFloat(plans[selectedPlan].price.replace('$', '')) * 12}
                  </span>
                  {plans[selectedPlan].yearlyPrice} ({plans[selectedPlan].yearlyDiscount})
                </p>
              )}
            </div>
            <div>
              {plans[selectedPlan].features.map((feature, index) => (
                <p key={index} style={{ color: 'var(--accent-color)' }}>
                  ✓ {feature}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>Payment Method</h3>
          {/* Payment form would go here */}
          <div style={{ 
            padding: '1rem',
            border: '2px dashed #e9ecef',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'var(--accent-color)'
          }}>
            Payment integration coming soon
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid var(--accent-color)',
              backgroundColor: 'transparent',
              color: 'var(--accent-color)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => handlePurchase(selectedPlan)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Complete Purchase
          </button>
        </div>
      </div>
    </div>
  )
}

export default Purchase
