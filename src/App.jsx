import { useEffect } from 'react'
import './App.css'
import haulzyLogo from './assets/Haulzy-BLOCK-Full-Transparent.png'
import LandingPage from './LandingPage'

function App() {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="logo-container">
          <img src={haulzyLogo} alt="Haulzy Logo" className="logo" />
        </div>
        <nav className="nav-menu">
          <button className="download-btn">Download</button>
          <a href="/login" className="login-tab">Login</a>
        </nav>
      </header>

      <LandingPage />

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <img src={haulzyLogo} alt="Haulzy Logo" className="footer-logo" />
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
              <a href="#">Privacy Policy</a>
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
