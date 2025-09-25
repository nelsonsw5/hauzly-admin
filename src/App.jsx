import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import './App.css'
import haulzyLogo from './assets/Haulzy-H-Circle.PNG'
import Navigation from './components/Navigation'

function App() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="app">
      <Navigation />
      
      <main className="main-content">
        <Outlet />
      </main>

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
              <li>
                <Link 
                  to="/" 
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                    window.scrollTo(0, 0)
                  }}
                >
                  Package Pickup
                </Link>
              </li>
              <li>
                <Link 
                  to="/" 
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                    window.scrollTo(0, 0)
                  }}
                >
                  Returns Management
                </Link>
              </li>
              <li>
                <Link 
                  to="/" 
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                    window.scrollTo(0, 0)
                  }}
                >
                  Delivery Service
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Company</h4>
            <ul className="footer-links">
              <li>
                <Link 
                  to="/" 
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                    window.scrollTo(0, 0)
                  }}
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link 
                  to="/signup" 
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/signup')
                    window.scrollTo(0, 0)
                  }}
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* <div className="footer-section">
            <h4>Support</h4>
            <ul className="footer-links"> */}
              {/* <li><a href="#">Help Center</a></li> */}
              {/* <li><a href="#">Contact Us</a></li> */}
              {/* <li><a href="#">Track Package</a></li> */}
              {/* <li><a href="#">FAQ</a></li> */}
            {/* </ul> */}
          {/* </div> */}

          <div className="footer-section">
            <h4>Contact</h4>
            <div className="contact-info">
              <p>📞 (801) 800-1191</p>
              <p>✉️ info@usehaulzy.com</p>
              <p>📍 Springville, UT</p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2025 Haulzy. All rights reserved.</p>
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