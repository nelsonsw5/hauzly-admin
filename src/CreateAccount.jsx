import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { auth, db, storage } from './firebase'
import './App.css'
import { fetchSignInMethodsForEmail } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { loadStripe } from '@stripe/stripe-js'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

// Firebase Cloud Function URLs
const FIREBASE_FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_URL

// Toggle to show/hide Family plan - set to false to hide it
const showFamilyPlan = false

function CreateAccount() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // All state declarations at the top
  const [priceData, setPriceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [planType, setPlanType] = useState(location.state?.selectedPlan === 'onetime' ? 'onetime' : 'subscription')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [showPremiumPlan, setShowPremiumPlan] = useState(false)
  const [showCostcoField, setShowCostcoField] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('basic') // Default to 'basic', will be updated by useEffect if premium is enabled
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [receiveTextUpdates, setReceiveTextUpdates] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [promoCodeError, setPromoCodeError] = useState('')
  const [promoCodeValidating, setPromoCodeValidating] = useState(false)
  const [promoCodeValidated, setPromoCodeValidated] = useState(false)
  const [costcoCardImage, setCostcoCardImage] = useState(null)
  const [costcoCardPreview, setCostcoCardPreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Helper functions
  const getDisplayPrice = (planId) => {
    if (!priceData) return { amount: '$0.00', period: '/month' }

    if (planType === 'onetime') {
      return {
        amount: oneTimePlan.priceMonthly || '$0.00',
        period: oneTimePlan.periodMonthly || 'per haul'
      }
    }

    const plan = subscriptionPlans[planId]
    if (!plan) return { amount: '$0.00', period: '/month' }

    return {
      amount: billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
      period: billingCycle === 'yearly' ? plan.periodYearly : plan.periodMonthly
    }
  }

  // Handle Costco card image selection
  const handleCostcoCardChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      setCostcoCardImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setCostcoCardPreview(reader.result)
      }
      reader.readAsDataURL(file)
      setError('')
    }
  }

  // Upload Costco card image to Firebase Storage
  const uploadCostcoCardImage = async (userId) => {
    console.log('📸 uploadCostcoCardImage called with userId:', userId);
    
    if (!costcoCardImage) {
      console.log('⚠️ No Costco card image provided, returning null');
      return null;
    }

    try {
      console.log('🔄 Setting uploadingImage to true');
      setUploadingImage(true);
      
      const timestamp = Date.now();
      const ext = costcoCardImage.name.split('.').pop();
      const filename = `${userId}_${timestamp}.${ext}`;
      const storagePath = `dev-costco-cards/${userId}/${filename}`;
      
      console.log('📝 Upload details:', {
        timestamp,
        extension: ext,
        filename,
        storagePath,
        fileSize: costcoCardImage.size,
        fileType: costcoCardImage.type
      });
      
      console.log('🔗 Creating storage reference...');
      const storageRef = ref(storage, storagePath);
      
      console.log('📤 Starting uploadBytesResumable...');
      const uploadTask = uploadBytesResumable(storageRef, costcoCardImage, {
        contentType: costcoCardImage.type,
        customMetadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      });

      // Wait for upload to complete
      console.log('⏳ Waiting for upload to complete...');
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📊 Upload progress: ${progress.toFixed(2)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
          },
          (error) => {
            console.error('❌ Upload error:', error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              serverResponse: error.serverResponse
            });
            reject(error);
          },
          async () => {
            console.log('✅ Upload completed successfully');
            try {
              console.log('🔗 Getting download URL...');
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('✅ Download URL obtained:', downloadUrl);
              const result = { downloadUrl, path: storagePath };
              console.log('📦 Returning result:', result);
              resolve(result);
            } catch (e) {
              console.error('❌ Error getting download URL:', e);
              reject(e);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading Costco card:', error)
      throw error
    } finally {
      setUploadingImage(false)
    }
  }

  // Fetch premium feature flag
  useEffect(() => {
    async function fetchPremiumFeatureFlag() {
      try {
        const flagDoc = await getDoc(doc(db, 'feature_flags', 'premium'));
        if (flagDoc.exists()) {
          const data = flagDoc.data();
          console.log('Premium feature flag:', data);
          // Check for 'show' field to control both Premium plan and Costco field
          const isEnabled = data.show === true;
          setShowPremiumPlan(isEnabled);
          setShowCostcoField(isEnabled);
          // Set default selected plan to premium if it's enabled and we're on subscription plan type
          if (isEnabled && planType === 'subscription') {
            setSelectedPlan('premium');
          }
        } else {
          console.log('No premium feature flag found, defaulting to false');
          setShowPremiumPlan(false);
          setShowCostcoField(false);
        }
      } catch (err) {
        console.error('Error fetching premium feature flag:', err);
        setShowPremiumPlan(false);
        setShowCostcoField(false);
      }
    }

    fetchPremiumFeatureFlag();
  }, [planType]);

  // Scroll to top on mount
  useEffect(() => {
    console.log('📄 SignUp component mounted');
    console.log('Initial state:', {
      planType,
      billingCycle,
      selectedPlan,
      showFamilyPlan
    });
    window.scrollTo(0, 0)
  }, [])

  // Log plan selection changes
  useEffect(() => {
    console.log('📋 Plan selection changed:', {
      planType,
      billingCycle,
      selectedPlan
    });
  }, [planType, billingCycle, selectedPlan]);

  // Auto-apply STARTER promo code for Basic Monthly
  useEffect(() => {
    // Only auto-apply if we're on Basic Monthly subscription
    const shouldApplyStarter = planType === 'subscription' && selectedPlan === 'basic' && billingCycle === 'monthly';
    
    if (shouldApplyStarter && promoCode !== 'STARTER') {
      console.log('🎟️ Auto-applying STARTER promo code for Basic Monthly');
      setPromoCode('STARTER');
      setPromoCodeError('');
      setPromoCodeValidated(false);
    } else if (!shouldApplyStarter && promoCode === 'STARTER') {
      // Clear STARTER code if user switches away from Basic Monthly
      console.log('🎟️ Clearing STARTER promo code (plan changed)');
      setPromoCode('');
      setPromoCodeError('');
      setPromoCodeValidated(false);
    }
  }, [planType, selectedPlan, billingCycle, promoCode]);

  // Fetch price data from Firestore
  useEffect(() => {
    async function fetchPriceData() {
      try {
        console.log('💰 Fetching price data from Firestore...');
        const settingsRef = doc(db, 'settings', 'products')
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          console.log('✅ Price data loaded from Firestore:', data)
          console.log('Subscription plans:', data.subscriptionPlans)
          console.log('One-time plan:', data.oneTimePlan)
          setPriceData(data)
        } else {
          console.error('❌ No products document found in settings collection')
          setError('Unable to load pricing information')
        }
      } catch (err) {
        console.error('❌ Error fetching price data:', err)
        setError('Unable to load pricing information')
      } finally {
        setLoading(false)
      }
    }

    fetchPriceData()
  }, [])
  



  // Compute derived data
  const subscriptionPlans = priceData?.subscriptionPlans || {}
  const oneTimePlan = priceData?.oneTimePlan || {}

  // Show loading state while fetching prices
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4">Loading pricing information...</h2>
      </div>
    )
  }

  // Show error if price data couldn't be loaded
  if (!priceData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Unable to load pricing information</h2>
        <p>Please try again later or contact support if the problem persists.</p>
      </div>
    )
  }


  // Function to validate promo code with backend
  const validatePromoCode = async (code, priceId) => {
    if (!code.trim()) {
      return { valid: true } // Empty promo code is valid (optional field)
    }

    try {
      setPromoCodeValidating(true)
      setPromoCodeError('')
      
      const response = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/validate_promo_code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          promo_code: code.trim(),
          price_id: priceId
        })
      })

      const data = await response.json()
      
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || 'Failed to validate promo code')
      }

      return data
    } catch (err) {
      console.error('Error validating promo code:', err)
      throw err
    } finally {
      setPromoCodeValidating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('📝 Form submission started');
    setError('');
    setPromoCodeError('');

    try {
      console.group('✅ Form Validation');
      
      // Validate required fields
      console.log('Validating first name:', firstName);
      if (!firstName.trim()) {
        throw new Error('First name is required');
      }
      
      console.log('Validating last name:', lastName);
      if (!lastName.trim()) {
        throw new Error('Last name is required');
      }
      
      console.log('Validating email:', email);
      if (!email.trim()) {
        throw new Error('Email is required');
      }
      
      console.log('Validating street address:', streetAddress);
      if (!streetAddress.trim()) {
        throw new Error('Street address is required');
      }
      
      console.log('Validating city:', city);
      if (!city.trim()) {
        throw new Error('City is required');
      }
      
      console.log('Validating state:', state);
      if (!state.trim()) {
        throw new Error('State is required');
      }
      
      console.log('Validating ZIP code:', zip);
      if (!zip.trim()) {
        throw new Error('ZIP code is required');
      }
      
      console.log('Validating password (length check only)');
      if (!password) {
        throw new Error('Password is required');
      }
      
      console.log('Validating password confirmation');
      if (!confirmPassword) {
        throw new Error('Please confirm your password');
      }

      // Validate password match
      console.log('Checking password match');
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate password length
      console.log('Checking password length:', password.length);
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Validate email format
      console.log('Validating email format');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Please enter a valid email address');
      }

      // Validate promo code with backend if subscription plan
      if (promoCode.trim() && planType === 'subscription') {
        console.log('Validating promo code with backend:', promoCode.trim().toUpperCase());
        
        // Determine price ID for validation
        let priceId = billingCycle === 'yearly' 
          ? subscriptionPlans[selectedPlan].priceYearlyId 
          : subscriptionPlans[selectedPlan].priceMonthlyId;
        
        const validation = await validatePromoCode(promoCode, priceId);
        
        if (!validation.valid) {
          setPromoCodeError(validation.message || 'Invalid promo code');
          throw new Error(validation.message || 'Invalid promo code');
        }
        
        console.log('✅ Promo code validated successfully:', validation);
        setPromoCodeValidated(true);
      }
      
      console.log('✅ All validations passed');
      console.groupEnd();

      // Only set submitting to true after validation passes
      setSubmitting(true);

      console.group('🔐 User Signup Process');

      // Check if user already exists
      console.log('🔍 Checking if email already exists:', email.trim());
      const signInMethods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (signInMethods.length > 0) {
        console.error('❌ Email already exists');
        throw new Error('An account with this email already exists');
      }
      console.log('✅ Email is available');

      // Create Firebase user
      console.log('👤 Creating Firebase user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      console.log('✅ User account created:', user.uid);

      // Upload Costco card image if provided
      console.group('📸 Uploading Costco card image');
      let costcoCardData = null;
      if (costcoCardImage) {
        try {
          console.log('📤 Uploading Costco card image...');
          costcoCardData = await uploadCostcoCardImage(user.uid);
          console.log('✅ Costco card uploaded:', costcoCardData);
        } catch (uploadError) {
          console.error('❌ Failed to upload Costco card:', uploadError);
          // Continue with signup even if image upload fails
        }
      } else {
        console.log('ℹ️ No Costco card image provided');
      }
      console.groupEnd();

      // Create Firestore user document
      console.group('📝 Creating Firestore user document');
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber ? phoneNumber.replace(/\D/g, '') : null,
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        country: 'US',
        type: 'customer',
        isAdmin: false,
        pickupCredit: false,
        approved: true,
        receiveTextUpdates: receiveTextUpdates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(promoCode.trim() && {
          signupPromoCode: promoCode.trim().toUpperCase(),
          signupPromoCodeEnteredAt: new Date().toISOString()
        }),
        ...(costcoCardData && {
          costcoCard: {
            url: costcoCardData.downloadUrl,
            path: costcoCardData.path,
            uploadedAt: new Date().toISOString()
          }
        })
      };
      console.log('📄 User data:', userData);
      await setDoc(doc(db, 'users', user.uid), userData);
      console.log('✅ Firestore document created');
      console.groupEnd();

      // Update profile
      console.log('🔄 Updating user profile...');
      await updateProfile(user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`
      });
      console.log('✅ Profile updated');

      // Check zip code approval
      console.group('📍 Zip Code Validation');
      console.log('🔍 Checking zip code:', zip.trim());
      const approvedZipsDoc = await getDoc(doc(db, 'settings', 'approved-zips'));
      let currentPlanType = planType;
      
      if (approvedZipsDoc.exists()) {
        const approvedZipsData = approvedZipsDoc.data();
        const zipData = approvedZipsData[zip.trim()];
        console.log('📊 Zip code data:', zipData);
        
        if (!zipData || !zipData.approved) {
          console.log('⚠️ Zip code not approved, defaulting to one-time plan');
          currentPlanType = 'onetime';
        } else {
          console.log('✅ Zip code approved');
        }
      } else {
        console.warn('⚠️ Approved-zips document not found, defaulting to one-time plan');
        currentPlanType = 'onetime';
      }
      console.groupEnd();

      // Handle plan routing
      console.group('🛍️ Plan Processing');
      if (currentPlanType === 'onetime') {
        console.log('➡️ One-time plan selected, redirecting to success page');
        
        // Track Meta Pixel conversion for one-time plan signup
        if (window.fbq) {
          window.fbq('track', 'CompleteRegistration', {
            content_name: 'One-Time Plan Signup',
            status: 'completed',
            value: 0,
            currency: 'USD'
          });
          console.log('✅ Meta Pixel: CompleteRegistration event fired (one-time plan)');
        }
        
        navigate('/checkout/success');
        console.groupEnd();
        console.groupEnd();
        return;
      }

      // Process subscription
      console.log('💳 Processing subscription plan');
      let priceId = billingCycle === 'yearly' 
        ? subscriptionPlans[selectedPlan].priceYearlyId 
        : subscriptionPlans[selectedPlan].priceMonthlyId;

      // Special promo code mapping for Basic Yearly plan
      const specialPromoCodes = ['CAMI', 'CHELSEA', 'CAROLINE', 'LEXI', 'MIKAELA', 'JEZNI', 'HOLIDAYS'];
      if (selectedPlan === 'basic' && billingCycle === 'yearly' && promoCode.trim() && specialPromoCodes.includes(promoCode.trim().toUpperCase())) {
        console.log('🎟️ Special promo code detected, mapping to price_1SSAUJ7TZwWADd5cLUKUPRYM');
        priceId = 'price_1SSAUJ7TZwWADd5cLUKUPRYM';
      }

      if (!priceId) {
        console.error('❌ Invalid price ID');
        throw new Error('Invalid plan selection');
      }
      console.log('💰 Selected price ID:', priceId);

      // Prepare checkout payload
      console.group('📦 Checkout Payload');
      const payload = {
        price_id: priceId,
        uid: user.uid,
        email: email.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        ...(phoneNumber && { phone: phoneNumber.replace(/\D/g, '') }),
        address: {
          line1: streetAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: zip.trim(),
          country: 'US'
        },
        ...(promoCode.trim() && { promotion_code: promoCode.trim().toUpperCase() })
      };
      console.log('📄 Final payload:', payload);
      console.groupEnd();
      console.groupEnd();

      // Process subscription purchase
      const response = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/purchase_subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Purchase failed:', errorData);
        throw new Error(errorData?.message || 'Failed to process purchase');
      }

      const data = await response.json();
      console.log('Purchase processed successfully:', data);

      // Track Meta Pixel conversion for subscription signup (before checkout)
      if (window.fbq) {
        window.fbq('track', 'CompleteRegistration', {
          content_name: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan Signup`,
          content_category: billingCycle,
          status: 'initiated_checkout',
          currency: 'USD'
        });
        console.log('✅ Meta Pixel: CompleteRegistration event fired (subscription plan)');
      }

      // Redirect to checkout
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) throw error;
      } else {
        throw new Error('No checkout URL or session ID provided');
      }
      
    } catch (err) {
      console.group('❌ Signup Error');
      console.error('Error during signup:', err);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error stack:', err.stack);
      
      // If we created a user but checkout failed, clean up by deleting the user
      // Only do this for subscription plans, not one-time plans
      if (planType !== 'onetime' && err.message.includes('Failed to process purchase') && auth.currentUser) {
        console.warn('⚠️ Checkout failed after user creation, attempting cleanup...');
        try {
          console.log('Deleting Firestore user document:', auth.currentUser.uid);
          await deleteDoc(doc(db, 'users', auth.currentUser.uid));
          console.log('Deleting Firebase Auth user');
          await auth.currentUser.delete();
          console.log('✅ User cleanup successful');
        } catch (deleteErr) {
          console.error('❌ Failed to clean up user after checkout error:', deleteErr);
        }
      }

      // Format user-friendly error messages
      let errorMessage = err.message;
      console.log('Original error message:', errorMessage);
      
      if (err.code) {
        console.log('Processing error code:', err.code);
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters long.';
            break;
          default:
            errorMessage = err.message || 'Failed to create account. Please try again.';
        }
      }

      console.log('Final error message to display:', errorMessage);
      console.log('Setting error state and resetting submitting state');
      console.groupEnd();

      setError(errorMessage);
      setSubmitting(false);
      
      // Scroll to top to show error message
      console.log('📜 Scrolling to top to show error');
      console.log('Current scroll position:', window.scrollY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Log after a short delay to see if error was set
      setTimeout(() => {
        console.log('Error state after setting:', errorMessage);
        console.log('Submitting state after setting:', false);
      }, 100);
    }
  };

  return (
    <main className="main-content" style={{ 
      padding: window.innerWidth <= 480 ? '0.75rem 0.5rem' : window.innerWidth <= 768 ? '1rem' : '1.5rem 1rem', 
      minHeight: '100vh', 
      position: 'relative',
      backgroundColor: '#f8f9fa',
      paddingBottom: window.innerWidth <= 768 ? '2rem' : '1.5rem'
    }}>

      {submitting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)',
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: window.innerWidth <= 480 ? '80px' : '100px',
              height: window.innerWidth <= 480 ? '80px' : '100px',
              border: '4px solid var(--primary-color)',
              borderRadius: '50%',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              marginBottom: '2rem',
            }}
          />
          <h2
            style={{
              color: 'var(--primary-color)',
              fontFamily: 'var(--font-heading)',
              textAlign: 'center',
              margin: 0,
              marginBottom: '1rem',
              fontSize: window.innerWidth <= 480 ? '1.25rem' : '1.5rem',
              padding: '0 1rem'
            }}
          >
            Getting you started with Haulzy
          </h2>
          <p
            style={{
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-body)',
              textAlign: 'center',
              margin: 0,
              opacity: 0.8,
              maxWidth: '300px',
              fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
              padding: '0 1rem'
            }}
          >
            {uploadingImage 
              ? "Uploading your Costco card image..." 
              : "We're setting up your free account and preparing your checkout session..."}
          </p>
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          input[type="checkbox"]:checked::after {
            content: '✓';
            color: white;
            font-size: ${window.innerWidth <= 768 ? '16px' : '14px'};
            font-weight: bold;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: block;
          }

          /* Smooth scrolling for horizontal scroll */
          .comparison-table-wrapper {
            scrollbar-width: thin;
            scrollbar-color: var(--primary-color) #f1f1f1;
          }

          .comparison-table-wrapper::-webkit-scrollbar {
            height: 6px;
          }

          .comparison-table-wrapper::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
            margin: 0 8px;
          }

          .comparison-table-wrapper::-webkit-scrollbar-thumb {
            background: var(--primary-color);
            border-radius: 4px;
          }

          .comparison-table-wrapper::-webkit-scrollbar-thumb:hover {
            background: #00b3a5;
          }

          /* Mobile scroll shadow indicators */
          @media (max-width: 768px) {
            .comparison-table-wrapper {
              background: 
                linear-gradient(90deg, var(--background-light) 0%, transparent 20px),
                linear-gradient(90deg, transparent calc(100% - 20px), var(--background-light) 100%),
                linear-gradient(90deg, rgba(0,0,0,.1) 0%, transparent 10px),
                linear-gradient(270deg, rgba(0,0,0,.1) 0%, transparent 10px);
              background-repeat: no-repeat;
              background-size: 20px 100%, 20px 100%, 10px 100%, 10px 100%;
              background-position: 0 0, 100% 0, 0 0, 100% 0;
              background-attachment: local, local, scroll, scroll;
            }
          }
        `}
      </style>
      <section
        className="form-container"
        style={{
          maxWidth: window.innerWidth <= 768 ? '100%' : window.innerWidth <= 1024 ? '900px' : '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
          flexDirection: window.innerWidth <= 1024 ? 'column' : 'row',
          gap: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
          padding: window.innerWidth <= 480 ? '0' : '0.5rem'
        }}
      >
        {/* Left: Plans */}
        <div
          style={{
            flex: window.innerWidth <= 1024 ? '1' : '1.2',
            backgroundColor: 'var(--background-light)',
            borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
            padding: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: window.innerWidth <= 480 ? '0.875rem' : '1rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0, 45, 71, 0.08)',
          }}
        >
          <h2 style={{ 
            margin: 0, 
            color: 'var(--text-dark)', 
            fontFamily: 'var(--font-heading)',
            fontSize: window.innerWidth <= 480 ? '1.35rem' : window.innerWidth <= 768 ? '1.5rem' : '1.75rem'
          }}>Choose Your Plan</h2>

          {/* Plan Type Toggle */}
          <div
            style={{
              display: 'flex',
              gap: window.innerWidth <= 480 ? '0.375rem' : '0.5rem',
              padding: window.innerWidth <= 480 ? '0.25rem' : '0.375rem',
              backgroundColor: 'var(--text-light)',
              borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPlanType('subscription')
                // Set to premium if available, otherwise basic
                setSelectedPlan(showPremiumPlan ? 'premium' : 'basic')
              }}
              style={{
                flex: 1,
                padding: window.innerWidth <= 480 ? '0.75rem 0.5rem' : window.innerWidth <= 768 ? '0.875rem 0.75rem' : '0.875rem 1rem',
                background: planType === 'subscription' ? 'var(--primary-color)' : 'transparent',
                color: planType === 'subscription' ? 'var(--text-light)' : 'var(--text-dark)',
                border: 'none',
                borderRadius: window.innerWidth <= 480 ? '4px' : '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                fontSize: window.innerWidth <= 480 ? '0.85rem' : window.innerWidth <= 768 ? '0.9rem' : '1rem',
                minHeight: window.innerWidth <= 480 ? '40px' : '44px',
                whiteSpace: window.innerWidth <= 480 ? 'nowrap' : 'normal',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {window.innerWidth <= 480 ? 'Subscription' : 'Subscription Plans'}
            </button>
            <button
              type="button"
              onClick={() => setPlanType('onetime')}
              style={{
                flex: 1,
                padding: window.innerWidth <= 480 ? '0.75rem 0.5rem' : window.innerWidth <= 768 ? '0.875rem 0.75rem' : '0.875rem 1rem',
                background: planType === 'onetime' ? 'var(--primary-color)' : 'transparent',
                color: planType === 'onetime' ? 'var(--text-light)' : 'var(--text-dark)',
                border: 'none',
                borderRadius: window.innerWidth <= 480 ? '4px' : '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                fontSize: window.innerWidth <= 480 ? '0.85rem' : window.innerWidth <= 768 ? '0.9rem' : '1rem',
                minHeight: window.innerWidth <= 480 ? '40px' : '44px',
                whiteSpace: window.innerWidth <= 480 ? 'nowrap' : 'normal',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {window.innerWidth <= 480 ? 'Pay per Haul' : 'Pay per Haul'}
            </button>
          </div>

          {/* Subscription Plans Section */}
          {planType === 'subscription' && (
            <>
              {/* Billing toggle */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: window.innerWidth <= 480 ? '0.5rem' : '0.75rem',
                  width: '100%',
                  padding: window.innerWidth <= 480 ? '0.75rem 0' : '1rem 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '1rem' : '1.5rem',
                    backgroundColor: 'var(--background-light)',
                    padding: window.innerWidth <= 480 ? '0.375rem' : '0.5rem',
                    borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
                    position: 'relative',
                    width: window.innerWidth <= 480 ? '100%' : 'fit-content',
                  }}
                >
                  {/* Monthly Option */}
                  <div
                    onClick={() => {
                      setBillingCycle('monthly')
                      if (selectedPlan === 'family') {
                        setSelectedPlan(showPremiumPlan ? 'premium' : 'basic')
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: window.innerWidth <= 480 ? '0.625rem 0.75rem' : window.innerWidth <= 768 ? '0.625rem 1rem' : '0.75rem 1.5rem',
                      cursor: 'pointer',
                      position: 'relative',
                      backgroundColor: billingCycle === 'monthly' ? 'white' : 'transparent',
                      borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                      boxShadow: billingCycle === 'monthly' ? '0 2px 8px rgba(0, 45, 71, 0.1)' : 'none',
                      transition: 'all 0.3s ease',
                      flex: window.innerWidth <= 480 ? 1 : 'initial',
                    }}
                  >
                    <span style={{
                      fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                      fontWeight: billingCycle === 'monthly' ? 700 : 500,
                      color: billingCycle === 'monthly' ? 'var(--primary-color)' : 'var(--text-dark)',
                      transition: 'all 0.3s ease',
                    }}>
                      Monthly
                    </span>
                    <span style={{
                      fontSize: window.innerWidth <= 480 ? '0.75rem' : '0.85rem',
                      color: 'var(--text-dark)',
                      opacity: 0.7,
                      marginTop: '0.25rem',
                      whiteSpace: 'nowrap'
                    }}>
                      {window.innerWidth <= 480 ? 'Regular' : 'Regular price'}
                    </span>
                  </div>

                  {/* Yearly Option */}
                  <div
                    onClick={() => setBillingCycle('yearly')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: window.innerWidth <= 480 ? '0.625rem 0.75rem' : window.innerWidth <= 768 ? '0.625rem 1rem' : '0.75rem 1.5rem',
                      cursor: 'pointer',
                      position: 'relative',
                      backgroundColor: billingCycle === 'yearly' ? 'white' : 'transparent',
                      borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                      boxShadow: billingCycle === 'yearly' ? '0 2px 8px rgba(0, 45, 71, 0.1)' : 'none',
                      transition: 'all 0.3s ease',
                      flex: window.innerWidth <= 480 ? 1 : 'initial',
                    }}
                  >
                    <span style={{
                      fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                      fontWeight: billingCycle === 'yearly' ? 700 : 500,
                      color: billingCycle === 'yearly' ? 'var(--primary-color)' : 'var(--text-dark)',
                      transition: 'all 0.3s ease',
                    }}>
                      Yearly
                    </span>
                    <span style={{
                      fontSize: window.innerWidth <= 480 ? '0.75rem' : '0.85rem',
                      color: 'var(--text-dark)',
                      opacity: 0.7,
                      marginTop: '0.25rem',
                      whiteSpace: 'nowrap'
                    }}>
                      Save 10%
                    </span>
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      fontSize: window.innerWidth <= 480 ? '0.65rem' : '0.75rem',
                      fontWeight: 700,
                      padding: window.innerWidth <= 480 ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                      borderRadius: '999px',
                      boxShadow: '0 2px 4px rgba(0, 191, 179, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {window.innerWidth <= 480 ? 'Best' : 'Best Value'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Trial Banner for Yearly Plans */}
              {billingCycle === 'yearly' && (
                <div style={{
                  backgroundColor: 'rgba(0, 191, 179, 0.08)',
                  color: 'var(--text-dark)',
                  padding: window.innerWidth <= 480 ? '0.625rem 0.875rem' : window.innerWidth <= 768 ? '0.75rem 1rem' : '0.875rem 1.25rem',
                  borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: window.innerWidth <= 480 ? '0.85rem' : window.innerWidth <= 768 ? '0.9rem' : '0.95rem',
                  fontFamily: 'var(--font-body)',
                  border: '1px solid rgba(0, 191, 179, 0.2)',
                  marginTop: window.innerWidth <= 480 ? '0.5rem' : '0.75rem',
                  marginBottom: window.innerWidth <= 480 ? '0.75rem' : '1rem'
                }}>
                  ✨ Start your 1 month free trial with any yearly plan
                </div>
              )}

              {/* Subscription Plans Comparison Table */}
              {(() => {
                // Calculate number of visible plans
                const visiblePlans = Object.entries(subscriptionPlans)
                  .filter(([planId]) => {
                    if (planId === 'family' && !showFamilyPlan) return false
                    if (planId === 'premium' && !showPremiumPlan) return false
                    return billingCycle === 'yearly' || planId !== 'family'
                  })
                  .sort(([planIdA], [planIdB]) => {
                    // Define the desired order: basic, premium, family
                    const order = { basic: 1, premium: 2, family: 3 }
                    return (order[planIdA] || 999) - (order[planIdB] || 999)
                  })
                
                const planCount = visiblePlans.length
                
                // If only one plan, show as a centered card
                if (planCount === 1) {
                  const [planId, plan] = visiblePlans[0]
                  const { amount, period } = getDisplayPrice(planId)
                  
                  return (
                    <div style={{
                      maxWidth: '400px',
                      margin: '0 auto',
                      width: '100%'
                    }}>
                      <div
                        style={{
                          textAlign: 'center',
                          border: '3px solid var(--primary-color)',
                          background: 'var(--text-light)',
                          borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
                          padding: window.innerWidth <= 480 ? '1.25rem' : window.innerWidth <= 768 ? '1.5rem' : '1.75rem',
                          boxShadow: '0 6px 20px rgba(0, 191, 179, 0.25)',
                          position: 'relative'
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          right: '-12px',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-color)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.25rem',
                          boxShadow: '0 2px 8px rgba(0, 191, 179, 0.4)'
                        }}>
                          ✓
                        </div>
                        
                        <h3 style={{
                          margin: '0 0 1.25rem 0',
                          fontSize: window.innerWidth <= 480 ? '1.5rem' : window.innerWidth <= 768 ? '1.65rem' : '1.85rem',
                          fontWeight: 700,
                          color: 'var(--text-dark)',
                          fontFamily: 'var(--font-heading)'
                        }}>
                          {plan.name}
                        </h3>
                        
                        <div style={{ marginBottom: '1.25rem' }}>
                          <span style={{
                            fontSize: window.innerWidth <= 480 ? '2.25rem' : window.innerWidth <= 768 ? '2.5rem' : '2.75rem',
                            fontWeight: 800,
                            color: 'var(--primary-color)'
                          }}>
                            {amount}
                          </span>
                          <span style={{
                            marginLeft: window.innerWidth <= 480 ? 4 : 6,
                            fontSize: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.1rem' : '1.2rem',
                            color: 'var(--text-dark)',
                            opacity: 0.7
                          }}>
                            {period}
                          </span>
                        </div>
                        
                        {billingCycle === 'yearly' && plan.priceYearly && plan.priceMonthly && (
                          <div style={{
                            marginBottom: '1.25rem',
                            fontSize: window.innerWidth <= 480 ? '0.85rem' : '0.95rem',
                            color: 'var(--text-dark)',
                            opacity: 0.7
                          }}>
                            <span style={{ textDecoration: 'line-through', marginRight: '8px' }}>
                              ${(parseFloat(plan.priceMonthly.replace('$', '')) * 12).toFixed(2)}
                            </span>
                            <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                              Save 10%
                            </span>
                          </div>
                        )}
                        
                        <ul style={{
                          margin: 0,
                          padding: 0,
                          listStyle: 'none',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: window.innerWidth <= 480 ? '0.625rem' : '0.75rem'
                        }}>
                          {plan.features
                            .filter(f => {
                              // For Basic plan, only show "All online returns" and "2 pickups per month"
                              if (planId === 'basic') {
                                const isOnlineReturns = f.toLowerCase().includes('ups')
                                const isPickups = f.toLowerCase().includes('2 pickups per month') || f.toLowerCase().includes('2 pickup')
                                return isOnlineReturns || isPickups
                              }
                              return true
                            })
                            .sort((a, b) => {
                              // Define the desired order for features
                              const featureOrder = [
                                'pickup', // "2 pickups per month" or "Unlimited pickups"
                                'online return', // "All online returns"
                                'costco',
                                'marketplace',
                                'packaging',
                                'label',
                                'deseret',
                                'donation'
                              ]
                              
                              // Find the index of each feature in the order array
                              const getOrderIndex = (feature) => {
                                const lowerFeature = feature.toLowerCase()
                                for (let i = 0; i < featureOrder.length; i++) {
                                  if (lowerFeature.includes(featureOrder[i])) {
                                    return i
                                  }
                                }
                                return featureOrder.length // Put unmatched features at the end
                              }
                              
                              return getOrderIndex(a) - getOrderIndex(b)
                            })
                            .map((f, idx) => (
                            <li key={idx} style={{
                              color: 'var(--text-dark)',
                              opacity: 0.85,
                              fontFamily: 'var(--font-body)',
                              fontSize: window.innerWidth <= 480 ? '0.95rem' : window.innerWidth <= 768 ? '1rem' : '1.05rem',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem'
                            }}>
                              <span style={{ color: 'var(--primary-color)', fontSize: '1.1rem', flexShrink: 0 }}>✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                }
                
                // Otherwise show comparison table
                return (
                  <>
              {window.innerWidth <= 768 && (
                <div style={{
                  textAlign: 'center',
                  fontSize: window.innerWidth <= 480 ? '0.75rem' : '0.8rem',
                  color: 'var(--text-dark)',
                  opacity: 0.6,
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <span>👉</span>
                  <span>Swipe to compare plans</span>
                  <span>👈</span>
                </div>
              )}
              <div className="comparison-table-wrapper" style={{ 
                width: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                marginTop: window.innerWidth <= 480 ? '0.5rem' : '0',
                position: 'relative',
                borderRadius: window.innerWidth <= 480 ? '8px' : '10px',
                backgroundColor: 'transparent'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth <= 480 ? '110px repeat(2, minmax(140px, 1fr))' : window.innerWidth <= 768 ? '140px repeat(2, minmax(160px, 1fr))' : '200px 1fr 1fr',
                  gap: window.innerWidth <= 480 ? '0.375rem' : window.innerWidth <= 768 ? '0.5rem' : '0.75rem',
                  minWidth: window.innerWidth <= 480 ? '420px' : window.innerWidth <= 768 ? '500px' : '650px',
                  padding: window.innerWidth <= 480 ? '0.375rem' : '0.5rem',
                  paddingBottom: window.innerWidth <= 768 ? '0.75rem' : '0.5rem'
                }}>
                  {/* Header Row */}
                  <div style={{ 
                    padding: window.innerWidth <= 480 ? '0.75rem 0.5rem' : window.innerWidth <= 768 ? '1rem 0.75rem' : '1.25rem 1rem',
                    display: 'flex',
                    alignItems: 'flex-end',
                    fontWeight: 700,
                    fontSize: window.innerWidth <= 480 ? '0.8rem' : window.innerWidth <= 768 ? '0.9rem' : '1.05rem',
                    color: 'var(--text-dark)',
                    fontFamily: 'var(--font-heading)'
                  }}>
                    Features
                  </div>
                  
                  {/* Plan Headers */}
                  {visiblePlans.map(([planId, plan]) => {
                      const { amount, period } = getDisplayPrice(planId)
                      const isSelected = selectedPlan === planId
                      const isBasicPlan = planId === 'basic'
                      return (
                        <button
                          key={planId}
                          onClick={() => setSelectedPlan(planId)}
                          style={{
                            padding: window.innerWidth <= 480 ? '0.875rem 0.5rem' : window.innerWidth <= 768 ? '1rem 0.75rem' : '1.25rem 1rem',
                            backgroundColor: isSelected ? 'var(--primary-color)' : 'white',
                            color: isSelected ? 'white' : 'var(--text-dark)',
                            border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                            borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: window.innerWidth <= 480 ? '0.375rem' : '0.5rem',
                            position: 'relative',
                            boxShadow: isSelected ? '0 6px 20px rgba(0, 191, 179, 0.3)' : '0 2px 8px rgba(0, 45, 71, 0.08)',
                            transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                            minHeight: window.innerWidth <= 480 ? '110px' : 'auto',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected && window.innerWidth > 768) {
                              e.currentTarget.style.transform = 'scale(1.02)'
                              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 45, 71, 0.12)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected && window.innerWidth > 768) {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 45, 71, 0.08)'
                            }
                          }}
                        >
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: window.innerWidth <= 480 ? '-8px' : '-10px',
                              right: window.innerWidth <= 480 ? '-8px' : '-10px',
                              width: window.innerWidth <= 480 ? '24px' : '28px',
                              height: window.innerWidth <= 480 ? '24px' : '28px',
                              borderRadius: '50%',
                              backgroundColor: 'white',
                              color: 'var(--primary-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: window.innerWidth <= 480 ? '0.85rem' : '1rem',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                            }}>
                              ✓
                            </div>
                          )}
                          <h3 style={{
                            margin: 0,
                            fontSize: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.15rem' : '1.35rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                            textAlign: 'center',
                            lineHeight: 1.2
                          }}>
                            {plan.name}
                          </h3>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: window.innerWidth <= 480 ? '1.25rem' : window.innerWidth <= 768 ? '1.4rem' : '1.65rem',
                              fontWeight: 800,
                              lineHeight: 1
                            }}>
                              {amount}
                            </div>
                            <div style={{
                              fontSize: window.innerWidth <= 480 ? '0.7rem' : window.innerWidth <= 768 ? '0.75rem' : '0.8rem',
                              opacity: isSelected ? 0.9 : 0.7,
                              marginTop: '0.25rem',
                              whiteSpace: 'nowrap'
                            }}>
                              {period}
                            </div>
                          </div>
                          {billingCycle === 'yearly' && plan.priceYearly && plan.priceMonthly && (
                            <div style={{
                              fontSize: window.innerWidth <= 480 ? '0.65rem' : '0.7rem',
                              fontWeight: 600,
                              padding: window.innerWidth <= 480 ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 191, 179, 0.1)',
                              color: isSelected ? 'white' : 'var(--primary-color)',
                              whiteSpace: 'nowrap'
                            }}>
                              Save 10%
                            </div>
                          )}
                        </button>
                      )
                    })}

                  {/* Feature Rows */}
                  {(() => {
                    // Get all unique features from all plans
                    const allFeatures = new Set()
                    const plansList = visiblePlans
                    
                    plansList.forEach(([planId, plan]) => {
                      plan.features.forEach(feature => {
                        // Skip "unlimited pickups" feature since we show it inline with "2 pickups per month"
                        const isUnlimitedPickup = feature.toLowerCase().includes('unlimited pickup') || 
                                                 feature.toLowerCase().includes('unlimited haul')
                        
                        // For Basic plan, only include "All online returns" and "2 pickups per month"
                        if (planId === 'basic') {
                          const isOnlineReturns = feature.toLowerCase().includes('all online returns')
                          const isPickups = feature.toLowerCase().includes('2 pickups per month') || feature.toLowerCase().includes('2 pickup')
                          if ((isOnlineReturns || isPickups) && !isUnlimitedPickup) {
                            allFeatures.add(feature)
                          }
                        } else {
                          // For other plans, add all features except unlimited pickups
                          if (!isUnlimitedPickup) {
                            allFeatures.add(feature)
                          }
                        }
                      })
                    })
                    
                    // Sort features in the desired order
                    const featureOrder = [
                      'pickup', // "2 pickups per month" or "Unlimited pickups"
                      'online return', // "All online returns"
                      'costco',
                      'marketplace',
                      'packaging',
                      'label',
                      'deseret',
                      'donation'
                    ]
                    
                    const getOrderIndex = (feature) => {
                      const lowerFeature = feature.toLowerCase()
                      for (let i = 0; i < featureOrder.length; i++) {
                        if (lowerFeature.includes(featureOrder[i])) {
                          return i
                        }
                      }
                      return featureOrder.length // Put unmatched features at the end
                    }
                    
                    const sortedFeatures = Array.from(allFeatures).sort((a, b) => {
                      return getOrderIndex(a) - getOrderIndex(b)
                    })

                    return sortedFeatures.map((feature, idx) => (
                      <div key={idx} style={{
                        display: 'contents'
                      }}>
                        {/* Feature Name */}
                        <div style={{
                          padding: window.innerWidth <= 480 ? '0.625rem 0.5rem' : window.innerWidth <= 768 ? '0.75rem 0.625rem' : '0.875rem 1rem',
                          backgroundColor: idx % 2 === 0 ? 'rgba(0, 45, 71, 0.02)' : 'white',
                          borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                          fontSize: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.8rem' : '0.9rem',
                          color: 'var(--text-dark)',
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          lineHeight: 1.3,
                          minHeight: window.innerWidth <= 480 ? '44px' : '48px',
                          wordBreak: 'break-word',
                          hyphens: 'auto'
                        }}>
                          {feature}
                        </div>
                        
                        {/* Check marks for each plan */}
                        {plansList.map(([planId, plan]) => {
                          const hasFeature = plan.features.includes(feature)
                          const isSelected = selectedPlan === planId
                          
                          // Check if this is the "2 pickups per month" feature and plan has unlimited
                          const isPickupFeature = feature.toLowerCase().includes('2 pickups per month') || feature.toLowerCase().includes('2 pickup') || feature.toLowerCase().includes('pickups per month')
                          const hasUnlimitedPickups = plan.features.some(f => 
                            f.toLowerCase().includes('unlimited pickup') || 
                            f.toLowerCase().includes('unlimited haul')
                          )
                          const showUnlimited = isPickupFeature && !hasFeature && hasUnlimitedPickups
                          
                          // Check if this is "All online returns" feature
                          const isOnlineReturnsFeature = feature.toLowerCase().includes('all online returns')
                          
                          // Basic plan should always show checkmark for "All online returns"
                          // Premium/other plans show checkmark if they have the feature OR if they have Costco returns (which includes all online returns)
                          const hasOnlineReturnsFeature = plan.features.some(f => 
                            f.toLowerCase().includes('all online returns') || 
                            f.toLowerCase().includes('ups') ||
                            (f.toLowerCase().includes('costco') && f.toLowerCase().includes('return'))
                          )
                          const showCheckForReturns = isOnlineReturnsFeature && !hasFeature && hasOnlineReturnsFeature
                          
                          return (
                            <div
                              key={planId}
                              style={{
                                padding: window.innerWidth <= 480 ? '0.625rem 0.5rem' : window.innerWidth <= 768 ? '0.75rem 0.625rem' : '0.875rem 1rem',
                                backgroundColor: idx % 2 === 0 ? 'rgba(0, 45, 71, 0.02)' : 'white',
                                borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: isSelected ? `2px solid var(--primary-color)` : '2px solid transparent',
                                transition: 'all 0.2s ease',
                                minHeight: window.innerWidth <= 480 ? '44px' : '48px'
                              }}
                            >
                              {hasFeature || showCheckForReturns ? (
                                <span style={{
                                  color: 'var(--primary-color)',
                                  fontSize: window.innerWidth <= 480 ? '1.1rem' : window.innerWidth <= 768 ? '1.2rem' : '1.4rem',
                                  fontWeight: 700
                                }}>
                                  ✓
                                </span>
                              ) : showUnlimited ? (
                                <span style={{
                                  color: 'var(--primary-color)',
                                  fontSize: window.innerWidth <= 480 ? '0.7rem' : window.innerWidth <= 768 ? '0.75rem' : '0.85rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: window.innerWidth <= 480 ? '0.3px' : '0.5px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Unlimited
                                </span>
                              ) : (
                                <span style={{
                                  color: '#dc2626',
                                  fontSize: window.innerWidth <= 480 ? '1.1rem' : window.innerWidth <= 768 ? '1.2rem' : '1.4rem',
                                  fontWeight: 700
                                }}>
                                  ✗
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>
              </div>
                  </>
                )
              })()}
            </>
          )}

          {/* Pay per Haul Plan Section */}
          {planType === 'onetime' && (
            <div
              style={{
                border: '2px solid var(--primary-color)',
                background: 'var(--text-light)',
                borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
                padding: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                boxShadow: '0 4px 14px rgba(0, 191, 179, 0.15)',
                textAlign: 'center',
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginBottom: window.innerWidth <= 480 ? '0.75rem' : '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <span
                  aria-hidden
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: window.innerWidth <= 480 ? 28 : 32,
                    height: window.innerWidth <= 480 ? 28 : 32,
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    color: 'var(--text-light)',
                    fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(0, 191, 179, 0.3)',
                    fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem'
                  }}
                >
                  ✓
                </span>
                <h3 style={{ 
                  margin: 0, 
                  color: 'var(--text-dark)', 
                  fontFamily: 'var(--font-heading)', 
                  fontSize: window.innerWidth <= 480 ? '1.25rem' : window.innerWidth <= 768 ? '1.35rem' : '1.5rem'
                }}>{oneTimePlan.name}</h3>
              </div>

              <div style={{ marginBottom: window.innerWidth <= 480 ? '0.75rem' : '1rem' }}>
                <span style={{ 
                  fontSize: window.innerWidth <= 480 ? '1.75rem' : window.innerWidth <= 768 ? '1.85rem' : '2rem', 
                  fontWeight: 800, 
                  color: 'var(--primary-color)' 
                }}>{oneTimePlan.priceMonthly}</span>
                <span style={{ 
                  marginLeft: window.innerWidth <= 480 ? 4 : 6, 
                  color: 'var(--text-dark)', 
                  opacity: 0.7, 
                  fontSize: window.innerWidth <= 480 ? '0.95rem' : window.innerWidth <= 768 ? '1rem' : '1.1rem' 
                }}>{oneTimePlan.periodMonthly}</span>
              </div>

              <ul style={{ 
                margin: 0, 
                padding: 0, 
                listStyle: 'none', 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: window.innerWidth <= 480 ? '0.5rem' : '0.625rem'
              }}>
                {oneTimePlan.features.map((f, idx) => (
                  <li key={idx} style={{ 
                    color: 'var(--text-dark)', 
                    opacity: 0.8, 
                    fontFamily: 'var(--font-body)', 
                    fontSize: window.innerWidth <= 480 ? '0.9rem' : window.innerWidth <= 768 ? '1rem' : '1.1rem',
                    lineHeight: 1.4
                  }}>✓ {f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div
          style={{
            flex: window.innerWidth <= 1024 ? '1' : '0.8',
            background: 'var(--text-light)',
            borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
            padding: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 45, 71, 0.1)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ 
            marginTop: 0, 
            marginBottom: window.innerWidth <= 480 ? '1rem' : '1.25rem',
            color: 'var(--text-dark)', 
            fontFamily: 'var(--font-heading)',
            fontSize: window.innerWidth <= 480 ? '1.35rem' : window.innerWidth <= 768 ? '1.5rem' : '1.75rem'
          }}>Get Started with Haulzy</h2>

          {error && (
            <div style={{ 
              color: '#dc2626', 
              fontSize: window.innerWidth <= 480 ? '0.9rem' : '0.95rem', 
              fontFamily: 'var(--font-body)',
              padding: window.innerWidth <= 480 ? '0.875rem 1rem' : '1rem 1.25rem',
              backgroundColor: '#fee2e2',
              borderRadius: window.innerWidth <= 480 ? '8px' : '10px',
              border: '2px solid #dc2626',
              lineHeight: 1.5,
              fontWeight: 600,
              marginBottom: window.innerWidth <= 480 ? '1rem' : '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => {
            console.log('📋 Form onSubmit triggered!');
            console.log('Event:', e);
            handleSubmit(e);
          }} style={{ 
            display: 'grid', 
            gap: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.875rem' : '1rem' 
          }}>
            <div style={{ 
              display: 'grid', 
              gap: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.875rem' : '1rem', 
              gridTemplateColumns: window.innerWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))' 
            }}>
              <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
            </div>

            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
            <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Street Address" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} style={inputStyle} required />

            <div style={{ 
              display: 'grid', 
              gap: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.875rem' : '1rem', 
              gridTemplateColumns: window.innerWidth <= 480 ? '1fr' : window.innerWidth <= 768 ? '2fr 1fr 1fr' : 'repeat(auto-fit, minmax(100px, 1fr))' 
            }}>
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} required />
              <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} required />
              <input type="text" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} required />
            </div>

            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />

            {/* Costco Card Upload */}
            {showCostcoField && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: window.innerWidth <= 480 ? '0.625rem' : window.innerWidth <= 768 ? '0.75rem' : '1rem',
              padding: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
              backgroundColor: 'var(--background-light)',
              borderRadius: window.innerWidth <= 480 ? '8px' : '12px',
              border: '2px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0, 45, 71, 0.06)'
            }}>
              {/* Header Section */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: window.innerWidth <= 480 ? '0.5rem' : '0.75rem',
                paddingBottom: window.innerWidth <= 480 ? '0.5rem' : '0.625rem',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <span style={{
                  fontSize: window.innerWidth <= 480 ? '1.25rem' : window.innerWidth <= 768 ? '1.5rem' : '1.75rem',
                  lineHeight: 1
                }}>📦</span>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block',
                    fontWeight: 700, 
                    color: 'var(--text-dark)', 
                    fontFamily: 'var(--font-body)',
                    fontSize: window.innerWidth <= 480 ? '0.9rem' : window.innerWidth <= 768 ? '1rem' : '1.1rem',
                    marginBottom: '0.25rem',
                    lineHeight: 1.3
                  }}>
                    Costco Membership Card
                  </label>
                  <span style={{
                    display: 'inline-block',
                    fontSize: window.innerWidth <= 480 ? '0.7rem' : window.innerWidth <= 768 ? '0.75rem' : '0.8rem',
                    color: 'var(--primary-color)',
                    backgroundColor: 'rgba(0, 191, 179, 0.1)',
                    padding: window.innerWidth <= 480 ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.3
                  }}>
                    {window.innerWidth <= 480 ? 'Optional' : 'Optional • Premium unlocks hassle-free Costco returns'}
                  </span>
                </div>
              </div>

              <p style={{ 
                margin: 0, 
                fontSize: window.innerWidth <= 480 ? '0.8rem' : window.innerWidth <= 768 ? '0.85rem' : '0.9rem', 
                color: 'var(--text-dark)', 
                opacity: 0.75,
                fontFamily: 'var(--font-body)',
                lineHeight: 1.4
              }}>
                Upload a clear photo of your Costco membership card barcode for verification
              </p>
              
              {/* File Input */}
              <div style={{
                marginTop: '0.25rem'
              }}>
                <label style={{
                  display: 'block',
                  width: '100%',
                  padding: window.innerWidth <= 480 ? '0.875rem' : window.innerWidth <= 768 ? '1rem' : '1.25rem',
                  backgroundColor: 'white',
                  border: '2px dashed var(--primary-color)',
                  borderRadius: window.innerWidth <= 480 ? '8px' : '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-body)',
                  fontSize: window.innerWidth <= 480 ? '0.85rem' : window.innerWidth <= 768 ? '0.9rem' : '1rem',
                  fontWeight: 600,
                  color: 'var(--primary-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (window.innerWidth > 768) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 191, 179, 0.05)'
                    e.currentTarget.style.borderColor = 'var(--primary-color)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (window.innerWidth > 768) {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = 'var(--primary-color)'
                  }
                }}
                >
                  <span style={{ 
                    fontSize: window.innerWidth <= 480 ? '1.25rem' : '1.5rem', 
                    display: 'block', 
                    marginBottom: window.innerWidth <= 480 ? '0.375rem' : '0.5rem' 
                  }}>📸</span>
                  <span style={{ display: 'block', marginBottom: '0.25rem' }}>
                    {costcoCardImage ? 'Change Photo' : 'Choose Photo'}
                  </span>
                  <span style={{ 
                    display: 'block', 
                    fontSize: window.innerWidth <= 480 ? '0.7rem' : window.innerWidth <= 768 ? '0.75rem' : '0.8rem',
                    color: 'var(--text-dark)',
                    opacity: 0.6,
                    fontWeight: 400
                  }}>
                    {window.innerWidth <= 480 ? 'Tap to select' : 'Click to browse or drag and drop'}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleCostcoCardChange}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                </label>
              </div>
              
              {/* Preview Section */}
              {costcoCardPreview && (
                <div style={{ 
                  marginTop: '0.5rem',
                  padding: window.innerWidth <= 480 ? '0.875rem' : window.innerWidth <= 768 ? '1rem' : '1.25rem',
                  backgroundColor: 'white',
                  borderRadius: window.innerWidth <= 480 ? '8px' : '10px',
                  border: '2px solid var(--primary-color)',
                  boxShadow: '0 2px 8px rgba(0, 191, 179, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: window.innerWidth <= 480 ? '0.375rem' : '0.5rem',
                    marginBottom: window.innerWidth <= 480 ? '0.5rem' : '0.75rem'
                  }}>
                    <span style={{ fontSize: window.innerWidth <= 480 ? '1.1rem' : '1.25rem' }}>✓</span>
                    <p style={{
                      margin: 0,
                      fontSize: window.innerWidth <= 480 ? '0.8rem' : window.innerWidth <= 768 ? '0.85rem' : '0.9rem',
                      fontWeight: 600,
                      color: 'var(--primary-color)',
                      fontFamily: 'var(--font-body)'
                    }}>
                      Your uploaded photo
                    </p>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: window.innerWidth <= 480 ? '0.5rem' : '0.75rem'
                  }}>
                    <img 
                      src={costcoCardPreview} 
                      alt="Costco card preview" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: window.innerWidth <= 480 ? '150px' : window.innerWidth <= 768 ? '180px' : '220px',
                        borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                        objectFit: 'contain',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCostcoCardImage(null)
                      setCostcoCardPreview(null)
                    }}
                    style={{
                      width: '100%',
                      padding: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.8rem' : '0.875rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: window.innerWidth <= 480 ? '6px' : '8px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: window.innerWidth <= 480 ? '0.85rem' : window.innerWidth <= 768 ? '0.9rem' : '0.95rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                      minHeight: window.innerWidth <= 480 ? '40px' : '44px'
                    }}
                    onMouseEnter={(e) => {
                      if (window.innerWidth > 768) {
                        e.currentTarget.style.backgroundColor = '#b91c1c'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.3)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (window.innerWidth > 768) {
                        e.currentTarget.style.backgroundColor = '#dc2626'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)'
                      }
                    }}
                  >
                    🗑️ Remove Photo
                  </button>
                </div>
              )}
            </div>
            )}

            {/* User Promo Code Input */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: window.innerWidth <= 480 ? '0.375rem' : '0.5rem'
            }}>
              <label style={{
                fontWeight: 600,
                color: 'var(--text-dark)',
                fontFamily: 'var(--font-body)',
                fontSize: window.innerWidth <= 480 ? '0.875rem' : window.innerWidth <= 768 ? '0.95rem' : '1rem'
              }}>
                Promo Code (Optional)
              </label>
              <input
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value)
                  setPromoCodeError('')
                  setPromoCodeValidated(false)
                }}
                style={{
                  ...inputStyle,
                  textTransform: 'uppercase',
                  borderColor: promoCodeError ? '#dc2626' : promoCodeValidated ? 'var(--primary-color)' : 'var(--border-color)'
                }}
              />
              {promoCodeError && (
                <p style={{
                  margin: 0,
                  fontSize: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.8rem' : '0.85rem',
                  color: '#dc2626',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600
                }}>
                  ⚠️ {promoCodeError}
                </p>
              )}
              {promoCodeValidated && !promoCodeError && (
                <p style={{
                  margin: 0,
                  fontSize: window.innerWidth <= 480 ? '0.75rem' : window.innerWidth <= 768 ? '0.8rem' : '0.85rem',
                  color: 'var(--primary-color)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600
                }}>
                  ✓ Promo code applied successfully
                </p>
              )}
            </div>

            <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: window.innerWidth <= 480 ? 10 : 12, 
                color: 'var(--text-dark)', 
                fontFamily: 'var(--font-body)',
                fontSize: window.innerWidth <= 480 ? '0.875rem' : window.innerWidth <= 768 ? '0.95rem' : '1rem',
                padding: window.innerWidth <= 480 ? '0.5rem 0' : window.innerWidth <= 768 ? '0.5rem 0' : '0.375rem 0',
                userSelect: 'none',
                cursor: 'pointer'
              }}>
              <input 
                type="checkbox" 
                checked={receiveTextUpdates} 
                onChange={(e) => setReceiveTextUpdates(e.target.checked)}
                style={{ 
                  accentColor: 'var(--primary-color)',
                  width: window.innerWidth <= 480 ? '18px' : window.innerWidth <= 768 ? '20px' : '18px',
                  height: window.innerWidth <= 480 ? '18px' : window.innerWidth <= 768 ? '20px' : '18px',
                  margin: 0,
                  cursor: 'pointer',
                  border: '2px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--text-light)',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                onInput={(e) => {
                  if (e.target.checked) {
                    e.target.style.backgroundColor = 'var(--primary-color)';
                    e.target.style.borderColor = 'var(--primary-color)';
                  } else {
                    e.target.style.backgroundColor = 'var(--text-light)';
                    e.target.style.borderColor = 'var(--border-color)';
                  }
                }}
              />
              <span style={{ flex: 1, lineHeight: 1.4 }}>Receive updates and support through text</span>
            </label>

          <button 
            type="submit" 
            disabled={submitting || promoCodeValidating}
            onClick={(e) => {
              console.log('🖱️ Button clicked!');
              console.log('Button type:', e.currentTarget.type);
              console.log('Form element:', e.currentTarget.form);
              console.log('Submitting state:', submitting);
            }}
            style={{ 
                padding: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1rem 1.25rem' : '1rem 1.5rem',
                background: (submitting || promoCodeValidating) ? 'var(--border-color)' : 'var(--primary-color)',
                color: 'var(--text-light)',
              border: 'none',
                borderRadius: window.innerWidth <= 480 ? '8px' : '10px',
                fontWeight: 700,
              cursor: (submitting || promoCodeValidating) ? 'not-allowed' : 'pointer',
              opacity: (submitting || promoCodeValidating) ? 0.7 : 1,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
                boxShadow: (submitting || promoCodeValidating) ? 'none' : '0 2px 4px rgba(0, 191, 179, 0.2)',
                minHeight: window.innerWidth <= 480 ? '48px' : '52px',
                fontSize: window.innerWidth <= 480 ? '1rem' : window.innerWidth <= 768 ? '1.1rem' : '1.05rem',
            }}
            onMouseEnter={(e) => {
              if (!submitting && !promoCodeValidating && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 191, 179, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting && !promoCodeValidating && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 191, 179, 0.2)'
              }
            }}
          >
            {promoCodeValidating ? 'Validating promo code...' : submitting ? 'Creating account...' : 'Sign Up'}
          </button>

            <div style={{ 
              textAlign: 'center', 
              color: 'var(--text-dark)', 
              fontFamily: 'var(--font-body)',
              fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
              padding: window.innerWidth <= 480 ? '0.5rem 0' : '0.25rem 0'
            }}>
              Already have an account?{' '}
              <Link to="/login" style={{ 
                color: 'var(--primary-color)', 
                textDecoration: 'underline', 
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                Login
              </Link>
            </div>
        </form>
        </div>
      </section>
    </main>
  )
}

const inputStyle = {
  padding: window.innerWidth <= 480 ? '0.875rem 0.75rem' : window.innerWidth <= 768 ? '0.875rem 0.875rem' : '1rem 1rem',
  border: '1px solid var(--border-color)',
  borderRadius: window.innerWidth <= 480 ? 6 : 8,
  fontSize: window.innerWidth <= 768 ? '16px' : '1rem', // 16px prevents zoom on iOS
  minHeight: window.innerWidth <= 480 ? '46px' : window.innerWidth <= 768 ? '48px' : '48px', // Better touch target
  width: '100%',
  fontFamily: 'var(--font-body)',
  color: 'var(--text-dark)',
  backgroundColor: 'var(--text-light)',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  outline: 'none',
  WebkitAppearance: 'none', // Remove iOS styling
  boxSizing: 'border-box',
};

export default CreateAccount;