import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './App.css';

function ManageAccount() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenEditModal = () => {
    setEditFormData({
      firstName: userData?.firstName || '',
      lastName: userData?.lastName || '',
      phone: userData?.phone || '',
      streetAddress: userData?.address?.line1 || '',
      city: userData?.address?.city || '',
      state: userData?.address?.state || '',
      zip: userData?.address?.postal_code || ''
    });
    setSaveError(null);
    setSaveSuccess(false);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);
      setSaveSuccess(false);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        phone: editFormData.phone,
        phoneNumber: editFormData.phone, // Some places use phoneNumber
        streetAdress: editFormData.streetAddress, // Note: typo in original field name
        city: editFormData.city,
        state: editFormData.state,
        zip: editFormData.zip,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setUserData(prev => ({
        ...prev,
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        phone: editFormData.phone,
        phoneNumber: editFormData.phone,
        streetAdress: editFormData.streetAddress,
        city: editFormData.city,
        state: editFormData.state,
        zip: editFormData.zip,
        address: {
          ...prev.address,
          line1: editFormData.streetAddress,
          city: editFormData.city,
          state: editFormData.state,
          postal_code: editFormData.zip
        }
      }));

      setSaveSuccess(true);
      setTimeout(() => {
        handleCloseEditModal();
      }, 1500);

    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveError('Failed to save profile. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setPasswordResetError(null);
    setPasswordResetSuccess(false);
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordResetError(null);
    setPasswordResetSuccess(false);
  };

  const handleConfirmPasswordChange = () => {
    setShowPasswordForm(true);
    setPasswordResetError(null);
  };

  const handleUpdatePassword = async () => {
    try {
      setPasswordResetLoading(true);
      setPasswordResetError(null);
      setPasswordResetSuccess(false);

      // Validation
      if (!newPassword || !confirmPassword) {
        throw new Error('Please fill in both password fields');
      }

      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);
      
      setPasswordResetSuccess(true);
      setTimeout(() => {
        handleClosePasswordModal();
      }, 2000);

    } catch (err) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordResetError('For security reasons, please log out and log back in before changing your password.');
      } else {
        setPasswordResetError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      setDeleteError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Get auth token
      const token = await user.getIdToken();

      // Call delete_account cloud function
      const apiUrl = `${import.meta.env.VITE_FIREBASE_URL}/delete_account`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          reason: 'User requested account deletion via web app'
        }),
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete account error:', errorText);
        throw new Error(`Failed to delete account: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Sign out the user
        await signOut(auth);
        
        // Redirect to home page
        navigate('/');
      } else {
        throw new Error(result.error || 'Failed to delete account');
      }

    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

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

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenEditModal}
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
            onClick={handleOpenPasswordModal}
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
          <button
            onClick={handleOpenDeleteModal}
            style={{
              background: 'transparent',
              color: '#dc2626',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '2px solid #dc2626',
              marginLeft: 'auto'
            }}
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={handleCloseEditModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: '600',
                marginBottom: '1.5rem',
                color: 'var(--text-dark)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Edit Profile
            </h2>

            {saveError && (
              <div
                style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div
                style={{
                  background: '#efe',
                  color: '#3c3',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                Profile updated successfully!
              </div>
            )}

            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {/* First Name & Last Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'var(--text-dark)'
                    }}
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) => handleEditFormChange('firstName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'var(--text-dark)'
                    }}
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) => handleEditFormChange('lastName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'var(--text-dark)'
                  }}
                >
                  Phone
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => handleEditFormChange('phone', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Street Address */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'var(--text-dark)'
                  }}
                >
                  Street Address
                </label>
                <input
                  type="text"
                  value={editFormData.streetAddress}
                  onChange={(e) => handleEditFormChange('streetAddress', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* City, State, ZIP */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'var(--text-dark)'
                    }}
                  >
                    City
                  </label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => handleEditFormChange('city', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'var(--text-dark)'
                    }}
                  >
                    State
                  </label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => handleEditFormChange('state', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'var(--text-dark)'
                    }}
                  >
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={editFormData.zip}
                    onChange={(e) => handleEditFormChange('zip', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseEditModal}
                disabled={saveLoading}
                style={{
                  background: 'transparent',
                  color: 'var(--text-dark)',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: saveLoading ? 'not-allowed' : 'pointer',
                  border: '2px solid var(--border-color)',
                  opacity: saveLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saveLoading}
                style={{
                  background: 'var(--primary-color)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: saveLoading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  opacity: saveLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
                {saveLoading && (
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
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={handleClosePasswordModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: '600',
                marginBottom: '1rem',
                color: 'var(--text-dark)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              {showPasswordForm ? 'Enter New Password' : 'Change Password?'}
            </h2>

            {!showPasswordForm ? (
              <>
                <p
                  style={{
                    color: 'var(--text-dark)',
                    marginBottom: '1.5rem',
                    lineHeight: '1.6',
                    fontSize: '1rem'
                  }}
                >
                  Are you sure you want to change your password?
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClosePasswordModal}
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
                    No, Cancel
                  </button>
                  <button
                    onClick={handleConfirmPasswordChange}
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
                    Yes, Change Password
                  </button>
                </div>
              </>
            ) : (
              <>
                {passwordResetError && (
                  <div
                    style={{
                      background: '#fee',
                      color: '#c33',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.9rem'
                    }}
                  >
                    {passwordResetError}
                  </div>
                )}

                {passwordResetSuccess && (
                  <div
                    style={{
                      background: '#efe',
                      color: '#3c3',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.9rem'
                    }}
                  >
                    Password updated successfully!
                  </div>
                )}

                <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontWeight: '500',
                        marginBottom: '0.5rem',
                        color: 'var(--text-dark)'
                      }}
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={passwordResetLoading || passwordResetSuccess}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        fontSize: '1rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontWeight: '500',
                        marginBottom: '0.5rem',
                        color: 'var(--text-dark)'
                      }}
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={passwordResetLoading || passwordResetSuccess}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        fontSize: '1rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClosePasswordModal}
                    disabled={passwordResetLoading}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-dark)',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: passwordResetLoading ? 'not-allowed' : 'pointer',
                      border: '2px solid var(--border-color)',
                      opacity: passwordResetLoading ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdatePassword}
                    disabled={passwordResetLoading || passwordResetSuccess}
                    style={{
                      background: 'var(--primary-color)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: (passwordResetLoading || passwordResetSuccess) ? 'not-allowed' : 'pointer',
                      border: 'none',
                      opacity: (passwordResetLoading || passwordResetSuccess) ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {passwordResetLoading ? 'Updating...' : passwordResetSuccess ? 'Updated!' : 'Update Password'}
                    {passwordResetLoading && (
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
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={handleCloseDeleteModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: '600',
                marginBottom: '1rem',
                color: '#dc2626',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Delete Account?
            </h2>

            <p
              style={{
                color: 'var(--text-dark)',
                marginBottom: '1rem',
                lineHeight: '1.6',
                fontSize: '1rem'
              }}
            >
              Are you sure you want to delete your account? This action cannot be undone.
            </p>

            <p
              style={{
                color: 'var(--text-dark)',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
                fontSize: '0.9rem',
                background: '#fef2f2',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}
            >
              <strong>Warning:</strong> Deleting your account will:
              <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                <li>Permanently delete your personal information</li>
                <li>Remove your access to all services</li>
                <li>Anonymize your business records (pickups, routes)</li>
                <li>Cancel any active subscriptions</li>
              </ul>
            </p>

            {deleteError && (
              <div
                style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseDeleteModal}
                disabled={deleteLoading}
                style={{
                  background: 'transparent',
                  color: 'var(--text-dark)',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  border: '2px solid var(--border-color)',
                  opacity: deleteLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  opacity: deleteLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                {deleteLoading && (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageAccount;
