import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import './App.css';

function ManageAccount() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const handleManageBilling = async () => {
    console.group('💳 Billing Portal Access');
    try {
      console.log('🔄 Starting billing portal access...');
      setBillingLoading(true);

      // User Authentication Check
      console.group('👤 User Authentication');
      const user = auth.currentUser;
      if (!user) {
        console.error('❌ No user logged in');
        throw new Error('No user logged in');
      }
      console.log('✅ User authenticated:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      });
      console.groupEnd();

      // API Configuration
      console.group('🔧 API Configuration');
      const apiUrl = `${import.meta.env.VITE_FIREBASE_URL}/create_portal_session`;
      console.log('📡 API URL:', apiUrl);
      console.log('🌐 Base URL:', import.meta.env.VITE_BASE_URL);
      console.groupEnd();

      // Token Generation
      console.group('🔑 Token Generation');
      console.time('Token Generation');
      const token = await user.getIdToken();
      console.timeEnd('Token Generation');
      console.log('✅ Token generated successfully');
      console.groupEnd();
      
      // Request Preparation
      console.group('📝 Request Preparation');
      const body = {
        returnUrl: `${import.meta.env.VITE_BASE_URL}/account`
      };
      console.log('📦 Request body:', body);
      console.log('🔤 Content type:', 'application/json');
      console.groupEnd();

      // API Request
      console.group('🚀 API Request');
      console.time('API Request');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        mode: 'cors'
      });
      console.timeEnd('API Request');

      // Response Analysis
      console.group('📥 Response Analysis');
      console.log('📊 Status:', response.status, response.statusText);
      console.log('🔍 Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        console.groupEnd(); // Response Analysis
        console.groupEnd(); // API Request
        throw new Error(`Failed to create billing portal session: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('📄 Raw response:', responseText || '(empty)');

      if (!responseText) {
        console.error('❌ Empty response received');
        console.groupEnd(); // Response Analysis
        console.groupEnd(); // API Request
        throw new Error('Server returned empty response');
      }

      // Response Parsing
      console.group('🔍 Response Parsing');
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('✅ Parsed response:', responseData);
      } catch (e) {
        console.error('❌ JSON parse error:', e);
        console.error('📄 Invalid response text:', responseText);
        console.groupEnd(); // Response Parsing
        console.groupEnd(); // Response Analysis
        console.groupEnd(); // API Request
        throw new Error('Invalid JSON response from server');
      }
      console.groupEnd(); // Response Parsing

      // URL Extraction and Redirect
      console.group('🔀 Redirect');
      const { url } = responseData;
      console.log('🔗 Redirect URL:', url);
      console.log('🚀 Initiating redirect...');
      window.location.href = url;
      console.groupEnd(); // Redirect
      
      console.groupEnd(); // Response Analysis
      console.groupEnd(); // API Request
    } catch (err) {
      console.group('❌ Error Handling');
      console.error('🚨 Error accessing billing portal:', err);
      
      // Provide more specific error messages based on the error type
      if (err.message.includes('No user logged in')) {
        console.log('📋 Error Type: Authentication - No User');
        setError('Please log in to access the billing portal.');
      } else if (response?.status === 401) {
        console.group('📋 Error Type: Authentication - Invalid Token');
        console.error('🔑 Auth Error Details:', err);
        console.log('👤 User Status:', auth.currentUser ? 'Logged In' : 'Logged Out');
        console.groupEnd();
        setError('Your session has expired. Please log in again to access the billing portal.');
      } else if (response?.status === 405) {
        console.group('📋 Error Type: Method Not Allowed');
        console.error('🔧 Method Error:', err);
        console.log('📡 Attempted Method:', 'POST');
        console.groupEnd();
        setError('Unable to access billing portal. Please try again later.');
      } else if (response?.status === 415) {
        console.group('📋 Error Type: Invalid Content Type');
        console.error('🔧 Content Type Error:', err);
        console.log('🔤 Attempted Content-Type:', 'application/json');
        console.groupEnd();
        setError('Unable to access billing portal. Please try again later.');
      } else if (err.message.includes('Failed to fetch')) {
        console.group('📋 Error Type: Network');
        console.error('🌐 Network Error:', err);
        console.log('🔧 Environment:', window.location.hostname);
        console.log('📡 API URL:', apiUrl);
        console.groupEnd();
        if (window.location.hostname === 'localhost') {
          setError('Unable to connect to billing portal. Please ensure the Firebase function is running and configured for local development.');
        } else {
          setError('Unable to connect to billing portal. Please check your internet connection and try again.');
        }
      } else {
        console.group('📋 Error Type: Unexpected');
        // Try to parse error message from response
        try {
          const errorData = await response?.json();
          console.log('📄 Server Error Details:', errorData);
          setError(errorData?.message || 'Unable to access the billing portal. Please try again later.');
        } catch (jsonError) {
          console.error('❌ Error Parsing Response:', jsonError);
          console.error('🔍 Original Error:', err);
          setError('An unexpected error occurred. Please try again later.');
        }
        console.groupEnd();
      }
      console.groupEnd(); // Error Handling
      console.groupEnd(); // Billing Portal Access
    } finally {
      console.log('✨ Cleaning up...');
      setBillingLoading(false);
      console.groupEnd(); // Ensure all groups are closed
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError('No user logged in');
          setLoading(false);
          return;
        }

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            ...data,
            email: data.email || user.email,
            displayName: data.name || user.displayName,
            firstName: data.firstName,
            lastName: data.lastName,
            subscription: {
              plan: data.billing?.subscription_type || data.subscription_type,
              status: data.billing?.subscription_status || data.subscription_status,
              nextBillingDate: data.billing?.current_period_end || data.current_period_end,  // This is already a Timestamp
              interval: data.billing?.interval || data.interval,
              approved: data.approved
            },
            address: {
              line1: data.streetAdress,
              city: data.city,
              state: data.state,
              postal_code: data.zip || "84663",
              country: data.country
            },
            phone: data.phone || data.phoneNumber,
            type: data.type,
            isAdmin: data.isAdmin,
            receiveTextUpdates: data.receiveTextUpdates,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            uid: data.uid
          });
        } else {
          setError('User data not found');
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4">Loading account details...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4 text-red-600">{error}</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '2rem',
          color: 'var(--text-dark)',
          fontFamily: 'var(--font-heading)'
        }}
      >
        Manage Account
      </h1>

      <div
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 45, 71, 0.08)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-heading)'
            }}
          >
            Personal Information
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                  First Name
                </label>
                <div style={{ fontSize: '1.1rem' }}>{userData?.firstName || 'Not set'}</div>
              </div>
              <div>
                <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                  Last Name
                </label>
                <div style={{ fontSize: '1.1rem' }}>{userData?.lastName || 'Not set'}</div>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Email
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.email}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Phone
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.phone || 'Not set'}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Account Type
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.type || 'Not set'}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Text Updates
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.receiveTextUpdates ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Member Since
              </label>
              <div style={{ fontSize: '1.1rem' }}>
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Not set'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-heading)'
            }}
          >
            Shipping Address
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Street Address
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.address?.line1 || 'Not set'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                  City
                </label>
                <div style={{ fontSize: '1.1rem' }}>{userData?.address?.city || 'Not set'}</div>
              </div>
              <div>
                <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                  State
                </label>
                <div style={{ fontSize: '1.1rem' }}>{userData?.address?.state || 'Not set'}</div>
              </div>
              <div>
                <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                  ZIP Code
                </label>
                <div style={{ fontSize: '1.1rem' }}>{userData?.address?.postal_code || 'Not set'}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-heading)'
            }}
          >
            Subscription Details
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Plan
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.subscription?.plan || 'No active subscription'}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Status
              </label>
              <div style={{ fontSize: '1.1rem' }}>{userData?.subscription?.status || 'No active subscription'}</div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Billing Interval
              </label>
              <div style={{ fontSize: '1.1rem' }}>
                {userData?.subscription?.interval ? `${userData.subscription.interval}ly` : 'Not set'}
              </div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Next Billing Date
              </label>
              <div style={{ fontSize: '1.1rem' }}>
                {userData?.subscription?.nextBillingDate ? 
                  new Date(userData.subscription.nextBillingDate.seconds * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })
                  : 'Not set'
                }
              </div>
            </div>
            <div>
              <label style={{ fontWeight: '500', color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Approval Status
              </label>
              <div style={{ fontSize: '1.1rem', color: userData?.subscription?.approved ? 'green' : 'orange' }}>
                {userData?.subscription?.approved ? 'Approved' : 'Pending Approval'}
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              {userData?.subscription?.status ? (
                <button
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  style={{
                    background: 'var(--primary-color)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: billingLoading ? 'not-allowed' : 'pointer',
                    border: 'none',
                    opacity: billingLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {billingLoading ? 'Loading...' : 'Manage Billing'}
                  {billingLoading && (
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                  )}
                </button>
              ) : (
                <button
                  onClick={() => window.location.href = '/upgrade'}
                  style={{
                    background: 'var(--primary-color)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Purchase Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button
            style={{
              background: 'var(--primary-color)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            Edit Profile
          </button>
          <button
            style={{
              background: 'transparent',
              color: 'var(--text-dark)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '2px solid var(--border-color)'
            }}
          >
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageAccount;
