import { useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import './App.css'
import haulzyLogo from './assets/Haulzy-BLOCK-Full-Transparent.png'
import { useAuth } from './AuthContext'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, logout } = useAuth()
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="logo-container">
          <Link to="/">
            <img src={haulzyLogo} alt="Haulzy Logo" className="logo" />
          </Link>
        </div>
        <nav className="nav-menu">
          {location.pathname === '/' && (
            <button className="download-btn" style={{ minHeight: '44px', minWidth: '44px' }}>Download</button>
          )}
          {location.pathname === '/' && (
            <button 
              className="login-tab" 
              onClick={() => {
                const pricingSection = document.getElementById('pricing')
                if (pricingSection) {
                  pricingSection.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Pricing
            </button>
          )}
          {user ? (
            <>
              <Link to="/dashboard" className="login-tab" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Dashboard</Link>
              <Link to="/returns" className="login-tab" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Returns</Link>
              {isAdmin && (
                <Link to="/users" className="login-tab" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Users</Link>
              )}
              <button
                className="login-tab"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
                style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-tab" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Login</Link>
              <Link to="/signup" className="login-tab" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sign Up</Link>
            </>
          )}
        </nav>
      </header>

      <Outlet />

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <Link to="/">
              <img src={haulzyLogo} alt="Haulzy Logo" className="footer-logo" />
            </Link>
            <p className="footer-tagline">
              Simplifying package management for busy lives
            </p>
            <div className="social-links">
              <a href="#" className="social-link" aria-label="Facebook">
                <span>📘</span>
              </a>
              <a href="#" className="social-link" aria-label="Twitter">
                <span>🐦</span>
              </a>
              <a href="#" className="social-link" aria-label="Instagram">
                <span>📷</span>
              </a>
              <a href="#" className="social-link" aria-label="LinkedIn">
                <span>💼</span>
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Services</h4>
            <ul className="footer-links">
              <li><a href="#">Package Pickup</a></li>
              <li><a href="#">Package Storage</a></li>
              <li><a href="#">Returns Management</a></li>
              <li><a href="#">Delivery Service</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Company</h4>
            <ul className="footer-links">
              <li><a href="#">About Us</a></li>
              <li><a href="#">How It Works</a></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#">Careers</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <ul className="footer-links">
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Contact Us</a></li>
              <li><a href="#">Track Package</a></li>
              <li><a href="#">FAQ</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Contact</h4>
            <div className="contact-info">
              <p>📞 (555) 123-HAUL</p>
              <p>✉️ hello@haulzy.com</p>
              <p>📍 San Francisco, CA</p>
              <p>🕒 24/7 Support</p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2024 Haulzy. All rights reserved.</p>
            <div className="footer-legal">
              <Link to="/privacy">Privacy Policy</Link>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App