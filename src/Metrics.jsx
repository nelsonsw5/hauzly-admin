import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import './Metrics.css'

// WARNING: Using Stripe secret key in frontend is NOT recommended for production
// This should only be used in a secure admin environment
const STRIPE_SECRET_KEY = import.meta.env.VITE_STRIPE_SECRET_KEY

// Excluded users - these emails will be filtered out from growth and revenue calculations
const EXCLUDED_EMAILS = [
  'demo@haulzy.com',
  'stephenwnelson5@gmail.com',
  'jh.framp7@gmail.com',
  'mt@tannertrading.com',
  'elsier.j2@gmail.com',
  'gregrthorpe06@gmail.com',
  'ejthorpe71@msn.com',
  'paytonrthorpe@gmail.com',
  'ele.nelson@icloud.com',
  'karglenkest@gmail.com',
  'laurafauxthorpe@gmail.com',
  'davendebrowe@gmail.com',
  'brbunk@yahoo.com'
]

function Metrics() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRangeDisplay, setDateRangeDisplay] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalPayingUsers: 0,
    totalUsers: 0,
    averageMonthlyRevenuePerCustomer: 0,
    revenuePerCustomerPerMonth: 0,  // Total revenue / customers / months
    monthlyGrowthPayingCustomers: 0,
    monthlyGrowthAllCustomers: 0  // Growth rate for all Stripe customers
  })
  
  // Debug metrics when they change
  useEffect(() => {
    console.log('📊 Metrics updated:', metrics)
    console.log('📊 monthlyGrowthAllCustomers:', metrics.monthlyGrowthAllCustomers)
  }, [metrics])

  useEffect(() => {
    loadMetricsData()
  }, [])

  // Load cached data from Firestore first, then fetch fresh data in background
  const loadMetricsData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        console.log('🔄 Force refresh requested, fetching fresh data...')
        await fetchAndUpdateData(null)
        return
      }
      
      // First, try to load cached data from Firestore
      const cachedData = await loadFromFirestore()
      
      if (cachedData) {
        console.log('📦 Loaded cached metrics from Firestore')
        console.log('📊 Cached metrics:', cachedData.metrics)
        setMetrics(cachedData.metrics)
        setDateRangeDisplay(cachedData.dateRangeDisplay || '')
        setLastUpdated(cachedData.lastUpdated)
        setLoading(false)
        
        // Check if Stripe key is configured
        if (!STRIPE_SECRET_KEY) {
          console.warn('⚠️ Stripe key not configured - displaying cached data only')
          console.warn('⚠️ To fetch fresh data, add VITE_STRIPE_SECRET_KEY to your .env file')
        } else {
        // Fetch fresh data in the background
        fetchAndUpdateData(cachedData)
        }
      } else {
        console.log('🔄 No cached data found, fetching fresh data...')
        // No cached data, fetch fresh data
        await fetchAndUpdateData(null)
      }
    } catch (err) {
      console.error('❌ Error loading metrics:', err)
      setError('Failed to load metrics data')
      setLoading(false)
    }
  }

  // Load metrics from Firestore cache
  const loadFromFirestore = async () => {
    try {
      const docRef = doc(db, 'admin_cache', 'metrics_data')
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return docSnap.data()
      }
      return null
    } catch (err) {
      console.error('❌ Error loading from Firestore:', err)
      return null
    }
  }

  // Save metrics to Firestore cache
  const saveToFirestore = async (metricsData, dateRange) => {
    try {
      const docRef = doc(db, 'admin_cache', 'metrics_data')
      await setDoc(docRef, {
        metrics: metricsData,
        dateRangeDisplay: dateRange,
        lastUpdated: new Date().toISOString()
      })
      console.log('💾 Saved metrics to Firestore cache')
    } catch (err) {
      console.error('❌ Error saving to Firestore:', err)
    }
  }

  // Fetch fresh data and update if different
  const fetchAndUpdateData = async (cachedData) => {
    try {
      const freshData = await fetchFinancialData()
      
      if (freshData) {
        // ALWAYS update with fresh data to ensure calculations are current
        console.log('🔄 Updating with fresh data...')
        setMetrics(freshData.metrics)
        setDateRangeDisplay(freshData.dateRangeDisplay)
        setLastUpdated(new Date().toISOString())
        
        // Save to Firestore for next time
        await saveToFirestore(freshData.metrics, freshData.dateRangeDisplay)
      }
    } catch (err) {
      console.error('❌ Error fetching fresh data:', err)
      // If we have cached data, we can continue using it
      if (!cachedData) {
        setError('Failed to fetch financial data')
      }
    } finally {
      setLoading(false)
    }
  }

  // Helper function to call Stripe API
  const callStripeAPI = async (endpoint, params = {}) => {
    const url = new URL(`https://api.stripe.com/v1/${endpoint}`)
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Stripe API error')
    }
    
    return response.json()
  }

  // Fetch all items from Stripe with pagination
  const fetchAllStripeItems = async (endpoint, params = {}) => {
    let allItems = []
    let hasMore = true
    let startingAfter = null
    
    while (hasMore) {
      const requestParams = { limit: 100, ...params }
      if (startingAfter) {
        requestParams.starting_after = startingAfter
      }
      
      const result = await callStripeAPI(endpoint, requestParams)
      allItems = allItems.concat(result.data)
      hasMore = result.has_more
      
      if (hasMore && result.data.length > 0) {
        startingAfter = result.data[result.data.length - 1].id
      }
    }
    
    return allItems
  }

  const fetchFinancialData = async () => {
    try {
      const user = auth.currentUser
      if (!user) {
        throw new Error('Please log in to view financial data')
      }

      if (!STRIPE_SECRET_KEY) {
        console.warn('⚠️ Stripe secret key not configured. Using cached data only.')
        return null
      }

      console.log('📊 Fetching financial data directly from Stripe...')
      
      // Define date range (complete months from Nov 1, 2024)
      const now = new Date()
      const projectionStartDate = new Date(Date.UTC(2024, 10, 1, 0, 0, 0)) // Nov 1, 2024
      const firstOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
      const projectionEndDate = new Date(firstOfCurrentMonth.getTime() - 1000) // End of last complete month
      
      const projectionStartTimestamp = Math.floor(projectionStartDate.getTime() / 1000)
      const projectionEndTimestamp = Math.floor(projectionEndDate.getTime() / 1000)
      
      console.log(`Date range: ${projectionStartDate.toISOString()} to ${projectionEndDate.toISOString()}`)
      
      // Fetch all charges
      console.log('Fetching all charges...')
      const allCharges = await fetchAllStripeItems('charges')
      console.log(`✅ Found ${allCharges.length} charges`)
      
      // Fetch all customers
      console.log('Fetching all customers...')
      const allCustomers = await fetchAllStripeItems('customers')
      console.log(`✅ Found ${allCustomers.length} customers`)
      
      // Fetch all subscriptions
      console.log('Fetching all subscriptions...')
      const allSubscriptions = await fetchAllStripeItems('subscriptions')
      console.log(`✅ Found ${allSubscriptions.length} subscriptions`)
      
      // Calculate total revenue
      let totalRevenue = 0
      let subscriptionRevenue = 0
      let onetimeRevenue = 0
      let refunds = 0
      
      for (const charge of allCharges) {
        if (charge.status === 'succeeded' && !charge.refunded) {
          const amount = charge.amount / 100
          totalRevenue += amount
          
          if (charge.invoice) {
            subscriptionRevenue += amount
          } else {
            onetimeRevenue += amount
          }
        }
        
        if (charge.refunded) {
          refunds += charge.amount_refunded / 100
        }
      }
      
      console.log(`Total revenue: $${totalRevenue.toFixed(2)}`)
      
      // Calculate revenue by customer
      const revenueByCustomer = {}
      const customerMap = {}
      let yearlySubscriptionCount = 0
      
      // Create customer lookup map
      for (const customer of allCustomers) {
        customerMap[customer.id] = {
          name: customer.name || customer.email || 'Unknown',
          email: customer.email || '',
          created: customer.created
        }
      }
      
      // Calculate revenue per customer
      for (const charge of allCharges) {
        if (charge.status === 'succeeded' && !charge.refunded && charge.customer) {
          const customerId = charge.customer
          
          if (!revenueByCustomer[customerId]) {
            const customerInfo = customerMap[customerId] || { name: 'Unknown', email: '', created: charge.created }
            revenueByCustomer[customerId] = {
              customerId,
              name: customerInfo.name,
              email: customerInfo.email,
              revenue: 0,
              monthlyRevenue: 0,
              transactionCount: 0,
              created: customerInfo.created
            }
          }
          
          const chargeAmount = charge.amount / 100
          revenueByCustomer[customerId].revenue += chargeAmount
          revenueByCustomer[customerId].transactionCount += 1
          
          // Calculate monthly equivalent (divide yearly by 12)
          let monthlyAmount = chargeAmount
          
          // Detect yearly subscriptions by amount
          // Basic yearly: $87, Premium yearly: $162
          const isYearlySubscription = chargeAmount === 87 || chargeAmount === 162
          
          if (isYearlySubscription) {
            monthlyAmount = chargeAmount / 12
            yearlySubscriptionCount++
            console.log(`🔍 Detected yearly subscription: $${chargeAmount} → Monthly equivalent: $${monthlyAmount.toFixed(2)}`)
          }
          
          revenueByCustomer[customerId].monthlyRevenue += monthlyAmount
        }
      }
      
      // Convert to array and sort
      const customerRevenueList = Object.values(revenueByCustomer).sort((a, b) => b.revenue - a.revenue)
      
      console.log(`💰 Processed ${yearlySubscriptionCount} yearly subscription charges (divided by 12 for monthly average)`)
      
      // Identify pay-per-pickup customers (no active subscription)
      const activeSubscriptionCustomerIds = new Set(
        allSubscriptions.filter(sub => sub.status === 'active').map(sub => sub.customer)
      )
      
      const payPerPickupCustomers = customerRevenueList
        .filter(customer => !activeSubscriptionCustomerIds.has(customer.customerId))
        .map(customer => ({
          customerId: customer.customerId,
          name: customer.name,
          email: customer.email,
          pickupCount: customer.transactionCount,
          revenue: customer.revenue
        }))
      
      console.log(`Found ${payPerPickupCustomers.length} pay-per-pickup customers`)
      
      // Calculate average monthly revenue per customer
      const totalMonthlyRevenue = customerRevenueList.reduce((sum, c) => sum + c.monthlyRevenue, 0)
      const avgMonthlyRevenuePerCustomer = customerRevenueList.length > 0 
        ? totalMonthlyRevenue / customerRevenueList.length 
        : 0
      
      // NEW APPROACH: Get all customers who have made at least one non-refunded payment
      // Group them by the month they were created in Stripe
      console.log('📊 Calculating paying customers by creation month...')
      
      // First, identify all customers with non-refunded payments
      const customersWithPayments = new Set()
      for (const charge of allCharges) {
        if (charge.status === 'succeeded' && !charge.refunded && charge.customer) {
          customersWithPayments.add(charge.customer)
        }
      }
      
      console.log(`✅ Found ${customersWithPayments.size} customers with non-refunded payments`)
      
      // Calculate revenue per customer per month (total revenue / paying customers / months with transactions)
      // Find all unique months where we had successful charges
      const monthsWithRevenue = new Set()
      for (const charge of allCharges) {
        if (charge.status === 'succeeded' && !charge.refunded) {
          const chargeDate = new Date(charge.created * 1000)
          const monthKey = `${chargeDate.getUTCFullYear()}-${String(chargeDate.getUTCMonth() + 1).padStart(2, '0')}`
          monthsWithRevenue.add(monthKey)
        }
      }
      
      const numberOfMonthsWithRevenue = monthsWithRevenue.size
      const numberOfPayingCustomers = customersWithPayments.size
      
      const revenuePerCustomerPerMonth = numberOfPayingCustomers > 0 && numberOfMonthsWithRevenue > 0
        ? totalRevenue / numberOfPayingCustomers / numberOfMonthsWithRevenue
        : 0
      
      console.log(`📊 Months with revenue: ${Array.from(monthsWithRevenue).sort().join(', ')}`)
      console.log(`📊 Revenue per customer per month: $${totalRevenue.toFixed(2)} / ${numberOfPayingCustomers} paying customers / ${numberOfMonthsWithRevenue} months = $${revenuePerCustomerPerMonth.toFixed(2)}`)
      
      // Now group these paying customers by their creation month
      const payingCustomersByMonth = {}
      
      for (const customer of allCustomers) {
        // Only include customers who have made a non-refunded payment
        if (customersWithPayments.has(customer.id)) {
          const createdDate = new Date(customer.created * 1000)
          
          // Only include customers created in our date range (complete months only)
          if (createdDate >= projectionStartDate && createdDate <= projectionEndDate) {
            const monthKey = `${createdDate.getUTCFullYear()}-${String(createdDate.getUTCMonth() + 1).padStart(2, '0')}`
            payingCustomersByMonth[monthKey] = (payingCustomersByMonth[monthKey] || 0) + 1
          }
        }
      }
      
      console.log('📊 Paying customers by creation month:', payingCustomersByMonth)
      console.log('📊 Total paying customers in date range:', Object.values(payingCustomersByMonth).reduce((sum, count) => sum + count, 0))
      
      // Group all customers by month (including current month)
      const allCustomersByMonth = {}
      for (const customer of allCustomers) {
        const createdDate = new Date(customer.created * 1000)
        if (createdDate >= projectionStartDate) {
          const monthKey = `${createdDate.getUTCFullYear()}-${String(createdDate.getUTCMonth() + 1).padStart(2, '0')}`
          allCustomersByMonth[monthKey] = (allCustomersByMonth[monthKey] || 0) + 1
        }
      }
      
      // Fetch users with no revenue from Firestore
      console.log('Fetching users from Firestore...')
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersWithNoRevenue = []
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data()
        
        if (userData.isAdmin || userData.userType === 'driver') continue
        
        const email = userData.email
        if (!email) continue
        
        // Check if user has any revenue in Stripe
        const hasRevenue = customerRevenueList.some(c => c.email?.toLowerCase() === email.toLowerCase())
        const hasSubscription = allSubscriptions.some(sub => {
          const customer = customerMap[sub.customer]
          return customer?.email?.toLowerCase() === email.toLowerCase()
        })
        
        if (!hasRevenue && !hasSubscription) {
          usersWithNoRevenue.push({
            userId: userDoc.id,
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A',
            email: email,
            createdAt: userData.createdAt || '',
            userType: userData.userType || ''
          })
        }
      }
      
      console.log(`Found ${usersWithNoRevenue.length} users with no revenue`)
      
      // Prepare monthly breakdown for paying customers
      const monthlyBreakdown = Object.keys(payingCustomersByMonth)
        .sort()
        .map(month => ({
          month,
          totalNewUsers: payingCustomersByMonth[month],
          subscriptionUsers: 0, // Could calculate this if needed
          payPerPickupUsers: 0
        }))
      
      // Format date range
      const dateRange = `All Time (Growth data from ${projectionStartDate.toLocaleDateString()} - ${projectionEndDate.toLocaleDateString()})`
      
      const data = {
        totalRevenue,
        subscriptionRevenue,
        oneTimeRevenue: onetimeRevenue,
        activeSubscribers: allSubscriptions.filter(sub => sub.status === 'active').length,
        totalSubscribers: allSubscriptions.length,
        revenueByCustomer: customerRevenueList,
        payPerPickupCustomers,
        usersWithNoRevenue,
        averageMonthlyRevenuePerCustomer: avgMonthlyRevenuePerCustomer,
        revenuePerCustomerPerMonth: revenuePerCustomerPerMonth,
        monthlyBreakdown,
        refunds,
        netRevenue: totalRevenue - refunds,
        dateRange,
        customersByMonth: allCustomersByMonth
      }
      
      console.log('✅ Financial data processed successfully')
      
      // Set date range display
      setDateRangeDisplay(data.dateRange)

        // Calculate total paying users (ALL users, including excluded emails)
        const totalPayingUsers = (data.revenueByCustomer || []).length + (data.payPerPickupCustomers || []).length
        
        // Calculate total users (ALL users, including excluded emails)
        const totalUsers = totalPayingUsers + (data.usersWithNoRevenue || []).length

        // Filter out excluded users ONLY for growth and revenue calculations
        const filteredRevenueByCustomer = (data.revenueByCustomer || []).filter(
          c => !c.email || !EXCLUDED_EMAILS.includes(c.email.toLowerCase())
        )
        const filteredPayPerPickupCustomers = (data.payPerPickupCustomers || []).filter(
          c => !c.email || !EXCLUDED_EMAILS.includes(c.email.toLowerCase())
        )
        const filteredUsersWithNoRevenue = (data.usersWithNoRevenue || []).filter(
          u => !u.email || !EXCLUDED_EMAILS.includes(u.email.toLowerCase())
        )

        // Calculate monthly growth rates from monthly breakdown (excluding filtered users)
        // Using method: (new users / cumulative previous) * 100, then average those percentages
        let monthlyGrowthPayingCustomers = 0
        let monthlyGrowthAllCustomers = 0
        
        // Calculate growth for PAYING customers (complete months only)
        if (data.monthlyBreakdown && data.monthlyBreakdown.length >= 2) {
          const sortedMonths = [...data.monthlyBreakdown].sort((a, b) => a.month.localeCompare(b.month))
          
          console.log('📊 Calculating growth from monthly breakdown:', sortedMonths)
          
          // Step 1: Create array of new users per month
          const newPayingUsersPerMonth = sortedMonths.map(month => 
          month.totalNewUsers || 0  // Use totalNewUsers which comes from payingCustomersByMonth
          )
          
          console.log('📈 New paying users per month:', newPayingUsersPerMonth)
          console.log('📅 Months:', sortedMonths.map(m => m.month))
          
          // Step 2: Calculate growth percentages using (new users / cumulative previous) * 100 method
          const payingGrowthPercentages = []
          
          // Track cumulative totals (sum of all previous months)
          let cumulativePayingBase = 0
        let payingBaseInitialized = false
          
          for (let i = 0; i < newPayingUsersPerMonth.length; i++) {
            const currentPayingUsers = newPayingUsersPerMonth[i]
            
          // For paying customers: skip months with 0 until we find the first month with customers
          if (!payingBaseInitialized && currentPayingUsers > 0) {
              cumulativePayingBase = currentPayingUsers
            payingBaseInitialized = true
            console.log(`📊 Month ${i} (${sortedMonths[i].month}): Initial paying base = ${cumulativePayingBase}`)
          } else if (payingBaseInitialized) {
            // Calculate growth once we have a base
            if (cumulativePayingBase > 0 && currentPayingUsers > 0) {
                const payingGrowth = (currentPayingUsers / cumulativePayingBase) * 100
                payingGrowthPercentages.push(payingGrowth)
                console.log(`📊 Month ${i} (${sortedMonths[i].month}): Paying = ${currentPayingUsers} / ${cumulativePayingBase} = ${payingGrowth.toFixed(2)}%`)
              }
              cumulativePayingBase += currentPayingUsers
            }
          }
          
          console.log('📈 Paying growth % per month:', payingGrowthPercentages)
          
          // Step 3: Average the growth percentages
          if (payingGrowthPercentages.length > 0) {
            monthlyGrowthPayingCustomers = payingGrowthPercentages.reduce((sum, val) => sum + val, 0) / payingGrowthPercentages.length
          }
          
          console.log('✅ Average monthly growth (paying):', monthlyGrowthPayingCustomers.toFixed(2) + '%')
        }

      // Calculate growth for ALL Stripe customers (including current month)
      console.log('🔍 DEBUG: Starting all customers growth calculation')
      console.log('🔍 DEBUG: data.customersByMonth =', data.customersByMonth)
      
      const allStripeCustomersByMonth = data.customersByMonth || {}
      console.log('🔍 DEBUG: allStripeCustomersByMonth =', allStripeCustomersByMonth)
      console.log('🔍 DEBUG: Object.keys(allStripeCustomersByMonth) =', Object.keys(allStripeCustomersByMonth))
      
      const sortedMonthKeys = Object.keys(allStripeCustomersByMonth).sort()
      console.log('🔍 DEBUG: sortedMonthKeys =', sortedMonthKeys)
      console.log('🔍 DEBUG: sortedMonthKeys.length =', sortedMonthKeys.length)
              
              if (sortedMonthKeys.length >= 2) {
        console.log('🔍 DEBUG: Condition met - sortedMonthKeys.length >= 2')
        const newUsersPerMonth = sortedMonthKeys.map(month => allStripeCustomersByMonth[month])
                console.log('📈 New users per month (all Stripe):', newUsersPerMonth)
                console.log('📅 Months (all Stripe):', sortedMonthKeys)
                
                const allGrowthPercentages = []
                let cumulativeBase = 0
                
                for (let i = 0; i < newUsersPerMonth.length; i++) {
                  const currentUsers = newUsersPerMonth[i]
          console.log(`🔍 DEBUG: Loop iteration ${i}, currentUsers = ${currentUsers}`)
                  
                  if (i === 0) {
                    cumulativeBase = currentUsers
                    console.log(`📊 Month ${i} (${sortedMonthKeys[i]}): Initial base = ${cumulativeBase} all customers`)
                  } else {
            console.log(`🔍 DEBUG: cumulativeBase = ${cumulativeBase}`)
                    if (cumulativeBase > 0) {
                      const growth = (currentUsers / cumulativeBase) * 100
                      allGrowthPercentages.push(growth)
                      console.log(`📊 Month ${i} (${sortedMonthKeys[i]}): All customers = ${currentUsers} / ${cumulativeBase} = ${growth.toFixed(2)}%`)
                    }
                    cumulativeBase += currentUsers
            console.log(`🔍 DEBUG: New cumulativeBase = ${cumulativeBase}`)
                  }
                }
        
        console.log('🔍 DEBUG: allGrowthPercentages =', allGrowthPercentages)
        console.log('🔍 DEBUG: allGrowthPercentages.length =', allGrowthPercentages.length)
                
                if (allGrowthPercentages.length > 0) {
                  monthlyGrowthAllCustomers = allGrowthPercentages.reduce((sum, val) => sum + val, 0) / allGrowthPercentages.length
          console.log('🔍 DEBUG: Calculated monthlyGrowthAllCustomers =', monthlyGrowthAllCustomers)
        } else {
          console.log('🔍 DEBUG: allGrowthPercentages is empty, monthlyGrowthAllCustomers remains 0')
                }
                
                console.log('✅ Average monthly growth (all Stripe customers):', monthlyGrowthAllCustomers.toFixed(2) + '%')
      } else {
        console.log('🔍 DEBUG: Condition NOT met - sortedMonthKeys.length < 2')
        console.log('🔍 DEBUG: Cannot calculate growth with less than 2 months of data')
        }

        const metricsData = {
          totalRevenue: data.totalRevenue || 0,
          totalPayingUsers: totalPayingUsers, // Includes ALL users
          totalUsers: totalUsers, // Includes ALL users
        averageMonthlyRevenuePerCustomer: data.averageMonthlyRevenuePerCustomer || 0,
        revenuePerCustomerPerMonth: data.revenuePerCustomerPerMonth || 0,
        monthlyGrowthPayingCustomers: monthlyGrowthPayingCustomers,
        monthlyGrowthAllCustomers: monthlyGrowthAllCustomers
        }

        return {
          metrics: metricsData,
          dateRangeDisplay: data.dateRange || ''
      }

    } catch (err) {
      console.error('❌ Error fetching financial data:', err)
      throw err
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="metrics-container">
        <div className="metrics-loading">Loading financial data from Stripe...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="metrics-container">
        <div className="metrics-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="metrics-container">
      <div className="metrics-header">
        <h1>Metrics Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {dateRangeDisplay && (
            <div className="date-range-display">
              <span className="date-range-label">Data Period:</span>
              <span className="date-range-value">{dateRangeDisplay}</span>
            </div>
          )}
          {lastUpdated && (
            <div style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '0.5rem'
            }}>
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card revenue">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <div className="metric-value">{formatCurrency(metrics.totalRevenue)}</div>
            <div className="metric-subtitle">
              All-time revenue
            </div>
          </div>
        </div>

        <div className="metric-card subscribers">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <h3>Total Paying Users</h3>
            <div className="metric-value">{metrics.totalPayingUsers}</div>
            <div className="metric-subtitle">
              Users who have paid
            </div>
          </div>
        </div>

        <div className="metric-card users">
          <div className="metric-icon">👤</div>
          <div className="metric-content">
            <h3>Total Users</h3>
            <div className="metric-value">{metrics.totalUsers}</div>
            <div className="metric-subtitle">
              All registered users
            </div>
          </div>
        </div>

        <div className="metric-card average">
          <div className="metric-icon">💳</div>
          <div className="metric-content">
            <h3>Avg Monthly Revenue</h3>
            <div className="metric-value">{formatCurrency(metrics.averageMonthlyRevenuePerCustomer)}</div>
            <div className="metric-subtitle">
              Per customer/month (normalized)
            </div>
          </div>
        </div>

        <div className="metric-card average">
          <div className="metric-icon">💵</div>
          <div className="metric-content">
            <h3>Revenue Per Customer Per Month</h3>
            <div className="metric-value">{formatCurrency(metrics.revenuePerCustomerPerMonth)}</div>
            <div className="metric-subtitle">
              Total revenue / customers / months
            </div>
          </div>
        </div>

        <div className="metric-card growth">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Monthly Growth (Paying)</h3>
            <div className="metric-value">{(metrics.monthlyGrowthPayingCustomers || 0).toFixed(1)}%</div>
            <div className="metric-subtitle">
              Customers with non-refunded payments
            </div>
          </div>
        </div>

        <div className="metric-card growth">
          <div className="metric-icon">🌐</div>
          <div className="metric-content">
            <h3>Monthly Growth (All Customers)</h3>
            <div className="metric-value">{(metrics.monthlyGrowthAllCustomers || 0).toFixed(1)}%</div>
            <div className="metric-subtitle">
              All Stripe customers (incl. current month)
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Metrics
