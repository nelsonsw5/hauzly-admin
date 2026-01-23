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

  // Debug logging
  console.log('Navigation Debug:', {
    pathname: location.pathname,
    isAdmin,
    user: user ? 'logged in' : 'not logged in',
    shouldHideButtons: isAdmin && (location.pathname === '/' || location.pathname === '/account')
  })

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handlePricingClick = () => {
    // If user is logged in, go to upgrade plan page
    if (user) {
      navigate('/upgrade')
      closeMobileMenu()
      return
    }

    // If not logged in, scroll to pricing section on landing page
    if (location.pathname !== '/') {
      navigate('/')
      // Add a small delay to allow navigation to complete
      setTimeout(() => {
        const pricingSection = document.getElementById('pricing')
        if (pricingSection) {
          pricingSection.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    } else {
      const pricingSection = document.getElementById('pricing')
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' })
      }
    }
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
          {/* Show Download and Pricing buttons on Login and Signup pages */}
          {/* Hide Download and Pricing if admin is on landing page or account page */}
          {(location.pathname === '/' || location.pathname === '/signup' || location.pathname === '/login' || location.pathname === '/account' || location.pathname === '/offer') && !(isAdmin && (location.pathname === '/' || location.pathname === '/account')) && (
            <Link 
              to="/download" 
              className="nav-link download-btn" 
              onClick={closeMobileMenu}
            >
              Download
            </Link>
          )}
          {(location.pathname === '/' || location.pathname === '/download' || location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/account' || location.pathname === '/offer') && !(isAdmin && (location.pathname === '/' || location.pathname === '/account')) && (
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
              <Link to="/route-calendar" className="nav-link admin-link" onClick={closeMobileMenu}>
                Route Calendar
              </Link>
              <Link to="/returns" className="nav-link admin-link" onClick={closeMobileMenu}>
                Returns
              </Link>
              <Link to="/users" className="nav-link admin-link" onClick={closeMobileMenu}>
                Users
              </Link>
              <Link to="/metrics" className="nav-link admin-link" onClick={closeMobileMenu}>
                Metrics
              </Link>
              <button className="nav-link logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : user ? (
            <>
              <Link to="/account" className="nav-link pricing-btn" onClick={closeMobileMenu}>
                Manage Account
              </Link>
              <button className="nav-link logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : location.pathname === '/login' ? (
            <Link to="/signup" className="nav-link signup-btn" onClick={closeMobileMenu}>
              Sign Up
            </Link>
          ) : location.pathname === '/signup' ? (
            <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu}>
              Login
            </Link>
          ) : (location.pathname === '/' || location.pathname === '/download' || location.pathname === '/offer') ? (
            <>
              <Link to="/signup" className="nav-link signup-btn" onClick={closeMobileMenu}>
                Sign Up
              </Link>
              <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu}>
                Login
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

export default Navigation