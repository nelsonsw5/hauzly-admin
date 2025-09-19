// Utility script to set up the first admin user
// This can be run in the browser console after signing up a user

import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

// Function to make a user an admin
// Usage: makeUserAdmin('user-uid-here')
export async function makeUserAdmin(userUid) {
  try {
    await updateDoc(doc(db, 'users', userUid), {
      role: 'admin'
    })
    console.log('User has been made an admin!')
    return true
  } catch (error) {
    console.error('Error making user admin:', error)
    return false
  }
}

// Function to check if current user is admin
// Usage: checkIfAdmin()
export async function checkIfAdmin() {
  try {
    const { getAuth } = await import('firebase/auth')
    const { getDoc } = await import('firebase/firestore')
    const auth = getAuth()
    
    if (!auth.currentUser) {
      console.log('No user logged in')
      return false
    }
    
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      console.log('User role:', userData.role)
      return userData.role === 'admin'
    }
    
    return false
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Instructions for manual setup
console.log(`
To set up the first admin user:

1. Sign up a new user account
2. Open browser console (F12)
3. Run: makeUserAdmin('USER_UID_HERE')
   (Replace USER_UID_HERE with the actual user UID from Firebase Auth)

Or to check if current user is admin:
Run: checkIfAdmin()
`)
