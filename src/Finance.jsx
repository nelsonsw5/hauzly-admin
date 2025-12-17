import { useState, useEffect } from 'react'
import { auth } from './firebase'
import './Finance.css'

const FIREBASE_FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_URL

function Finance() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRangeDisplay, setDateRangeDisplay] = useState('')
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    oneTimeRevenue: 0,
    activeSubscribers: 0,
    totalSubscribers: 0,
    averageOrderValue: 0,
    revenueByPlan: {},
    recentTransactions: [],
    revenueByCustomer: [],
    growthMetrics: {
      avgNewCustomersPerMonth: 0,
      projectedNewCustomersPerYear: 0,
      projectedRevenueFromNewCustomers: 0,
      totalProjectedRevenue: 0
    },
    averageMonthlyRevenuePerCustomer: 0,
    projectedYearlyRevenue: 0,
    refunds: 0,
    netRevenue: 0,
    payPerPickupCustomers: [],
    usersWithNoRevenue: []
  })

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    setLoading(true)
    setError('')

    try {
      const user = auth.currentUser
      if (!user) {
        setError('Please log in to view financial data')
        setLoading(false)
        return
      }

      console.log('📊 Fetching financial data from Stripe...')
      const response = await fetch(
        `${FIREBASE_FUNCTIONS_BASE_URL}/get_stripe_financial_data?uid=${user.uid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch financial data')
      }

      const result = await response.json()
      console.log('✅ Financial data received:', result)

      if (result.status === 'success') {
        const data = result.data
        
        // Calculate average order value
        const averageOrderValue = data.totalSubscribers > 0 
          ? data.totalRevenue / data.totalSubscribers 
          : 0

        // Set date range display
        if (data.dateRange) {
          setDateRangeDisplay(data.dateRange)
        }

        setMetrics({
          totalRevenue: data.totalRevenue,
          subscriptionRevenue: data.subscriptionRevenue,
          oneTimeRevenue: data.oneTimeRevenue,
          activeSubscribers: data.activeSubscribers,
          totalSubscribers: data.totalSubscribers,
          averageOrderValue,
          revenueByPlan: data.revenueByPlan,
          recentTransactions: data.recentTransactions,
          revenueByCustomer: data.revenueByCustomer || [],
          growthMetrics: data.growthMetrics || {
            avgNewCustomersPerMonth: 0,
            projectedNewCustomersPerYear: 0,
            projectedRevenueFromNewCustomers: 0,
            totalProjectedRevenue: 0
          },
          averageMonthlyRevenuePerCustomer: data.averageMonthlyRevenuePerCustomer || 0,
          projectedYearlyRevenue: data.projectedYearlyRevenue || 0,
          refunds: data.refunds,
          netRevenue: data.netRevenue,
          payPerPickupCustomers: data.payPerPickupCustomers || [],
          usersWithNoRevenue: data.usersWithNoRevenue || []
        })
      } else {
        throw new Error(result.message || 'Failed to fetch financial data')
      }

    } catch (err) {
      console.error('❌ Error fetching financial data:', err)
      setError('Failed to load financial data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="finance-container">
        <div className="finance-loading">Loading financial data from Stripe...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="finance-container">
        <div className="finance-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="finance-container">
      <div className="finance-header">
        <h1>Financial Dashboard</h1>
        {dateRangeDisplay && (
          <div className="date-range-display">
            <span className="date-range-label">Data Period:</span>
            <span className="date-range-value">{dateRangeDisplay}</span>
          </div>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card revenue">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Net Revenue</h3>
            <div className="metric-value">{formatCurrency(metrics.netRevenue)}</div>
            <div className="metric-subtitle">
              After refunds: {formatCurrency(metrics.refunds)}
            </div>
          </div>
        </div>

        <div className="metric-card subscribers">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <h3>Active Subscribers</h3>
            <div className="metric-value">{metrics.activeSubscribers}</div>
            <div className="metric-subtitle">
              {metrics.totalSubscribers} total subscribers
            </div>
          </div>
        </div>

        <div className="metric-card average">
          <div className="metric-icon">💳</div>
          <div className="metric-content">
            <h3>Avg Monthly Revenue</h3>
            <div className="metric-value">{formatCurrency(metrics.averageMonthlyRevenuePerCustomer)}</div>
            <div className="metric-subtitle">
              Per customer/month
            </div>
          </div>
        </div>

        <div className="metric-card projection">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Projected Yearly</h3>
            <div className="metric-value">{formatCurrency(metrics.projectedYearlyRevenue)}</div>
            <div className="metric-subtitle">
              Based on current customers
            </div>
          </div>
        </div>
      </div>

      {/* Pay-Per-Pickup Customers */}
      <div className="section-card customers-section">
        <h2>Pay-Per-Pickup Customers</h2>
        <p className="section-subtitle">
          Customers without active subscriptions: {metrics.payPerPickupCustomers.length}
        </p>
        {metrics.payPerPickupCustomers.length > 0 && (
          <p className="table-scroll-hint">← Scroll horizontally to see all columns →</p>
        )}
        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Email</th>
                <th>Pickups</th>
                <th>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.payPerPickupCustomers.length > 0 ? (
                metrics.payPerPickupCustomers.map((customer, index) => (
                  <tr key={customer.customerId || index}>
                    <td className="customer-name-cell">{customer.name}</td>
                    <td className="customer-email-cell">{customer.email}</td>
                    <td className="transaction-count-cell">{customer.pickupCount}</td>
                    <td className="revenue-cell">{formatCurrency(customer.revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    No pay-per-pickup customers found in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users With No Revenue */}
      <div className="section-card customers-section">
        <h2>Users With No Revenue</h2>
        <p className="section-subtitle">
          Users who have signed up but never paid or subscribed: {metrics.usersWithNoRevenue.length}
        </p>
        {metrics.usersWithNoRevenue.length > 0 && (
          <p className="table-scroll-hint">← Scroll horizontally to see all columns →</p>
        )}
        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>User Type</th>
                <th>Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {metrics.usersWithNoRevenue.length > 0 ? (
                metrics.usersWithNoRevenue.map((user, index) => (
                  <tr key={user.userId || index}>
                    <td className="customer-name-cell">{user.name}</td>
                    <td className="customer-email-cell">{user.email}</td>
                    <td className="transaction-count-cell">{user.userType || 'customer'}</td>
                    <td className="revenue-cell">{formatDate(user.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    All users have made at least one payment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Growth Metrics */}
      <div className="section-card growth-section">
        <h2>Customer Growth & Projections</h2>
        <p className="section-subtitle">
          Based on historical acquisition rate of paying customers
        </p>
        <div className="growth-metrics-grid">
          <div className="growth-metric-card">
            <div className="growth-metric-icon">📊</div>
            <div className="growth-metric-content">
              <h3>Avg New Customers</h3>
              <div className="growth-metric-value">
                {metrics.growthMetrics.avgNewCustomersPerMonth.toFixed(1)}
              </div>
              <div className="growth-metric-subtitle">Per month</div>
            </div>
          </div>

          <div className="growth-metric-card">
            <div className="growth-metric-icon">🚀</div>
            <div className="growth-metric-content">
              <h3>Projected New Customers</h3>
              <div className="growth-metric-value">
                {metrics.growthMetrics.projectedNewCustomersPerYear.toFixed(0)}
              </div>
              <div className="growth-metric-subtitle">Next 12 months</div>
            </div>
          </div>

          <div className="growth-metric-card highlight">
            <div className="growth-metric-icon">💰</div>
            <div className="growth-metric-content">
              <h3>Total Projected Revenue</h3>
              <div className="growth-metric-value">
                {formatCurrency(metrics.growthMetrics.totalProjectedRevenue)}
              </div>
              <div className="growth-metric-subtitle">All customers (yearly)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue by Plan */}
      <div className="section-card customers-section">
        <h2>Revenue by Plan</h2>
        <p className="section-subtitle">
          Debug - All plans: {Object.keys(metrics.revenueByPlan).join(', ')}
        </p>
        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="customer-name-cell">Premium</td>
                <td className="revenue-cell">
                  {formatCurrency(
                    Object.entries(metrics.revenueByPlan)
                      .filter(([plan]) => plan.toLowerCase().includes('premium'))
                      .reduce((sum, [, data]) => sum + data.revenue, 0)
                  )}
                </td>
              </tr>
              <tr>
                <td className="customer-name-cell">Basic</td>
                <td className="revenue-cell">
                  {formatCurrency(
                    Object.entries(metrics.revenueByPlan)
                      .filter(([plan]) => plan.toLowerCase().includes('basic'))
                      .reduce((sum, [, data]) => sum + data.revenue, 0)
                  )}
                </td>
              </tr>
              <tr>
                <td className="customer-name-cell">Pay per Haul</td>
                <td className="revenue-cell">
                  {formatCurrency(
                    Object.entries(metrics.revenueByPlan)
                      .filter(([plan]) => 
                        plan.toLowerCase().includes('one-time') || 
                        plan.toLowerCase().includes('pay per') ||
                        plan.toLowerCase().includes('pickup')
                      )
                      .reduce((sum, [, data]) => sum + data.revenue, 0)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by Customer */}
      <div className="section-card customers-section">
        <h2>Revenue by Customer</h2>
        <p className="section-subtitle">
          Total customers with revenue: {metrics.revenueByCustomer.length}
        </p>
        {metrics.revenueByCustomer.length > 0 && (
          <p className="table-scroll-hint">← Scroll horizontally to see all columns →</p>
        )}
        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Email</th>
                <th>Transactions</th>
                <th>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.revenueByCustomer.length > 0 ? (
                metrics.revenueByCustomer.map((customer, index) => (
                  <tr key={customer.customerId || index}>
                    <td className="customer-name-cell">{customer.name}</td>
                    <td className="customer-email-cell">{customer.email}</td>
                    <td className="transaction-count-cell">{customer.transactionCount}</td>
                    <td className="revenue-cell">{formatCurrency(customer.revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    No customer revenue data found in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default Finance
