import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import './Navigation.css'
import haulzyLogo from '../assets/Haulzy-BLOCK-Full-Transparent.png'
import { useAuth } from '../AuthContext'

function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handlePricingClick = () => {
    navigate('/signup')
    closeMobileMenu()
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
    closeMobileMenu()
  }

  return (
    <header className="navigation-header">
      <div className="navigation-container">
        <div className="logo-container">
          <Link to="/" onClick={closeMobileMenu}>
            <img src={haulzyLogo} alt="Haulzy Logo" className="logo" />
          </Link>
        </div>
        
        {/* Hamburger Menu Button */}
        <button 
          className={`hamburger-menu ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        
        <nav className={`nav-menu ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          {(location.pathname === '/' || location.pathname === '/signup') && (
            <Link 
              to="/download" 
              className="nav-link download-btn" 
              onClick={closeMobileMenu}
            >
              Download
            </Link>
          )}
          {(location.pathname === '/' || location.pathname === '/download') && (
            <button 
              className="nav-link pricing-btn" 
              onClick={handlePricingClick}
            >
              Pricing
            </button>
          )}
          
          {user && isAdmin ? (
            <>
              <Link to="/dashboard" className="nav-link admin-link" onClick={closeMobileMenu}>
                Dashboard
              </Link>
              <Link to="/returns" className="nav-link admin-link" onClick={closeMobileMenu}>
                Returns
              </Link>
              <Link to="/users" className="nav-link admin-link" onClick={closeMobileMenu}>
                Users
              </Link>
              <button className="nav-link logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : user ? (
            <button className="nav-link logout-btn" onClick={handleLogout}>
              Logout
            </button>
          ) : location.pathname === '/' ? (
            <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu}>
              Login
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

export default Navigation