import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

const auth = getAuth(app);
// Properly set persistence to LOCAL
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting auth persistence:", error);
});
const db = getFirestore(app);

// Username management functions
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  if (!username) {
    throw new Error('Username cannot be empty');
  }

  try {
    console.log('Checking username availability for:', username);
    const normalizedUsername = username.toLowerCase().trim();
    const usernameRef = doc(db, 'usernames', normalizedUsername);
    
    // Add retry mechanism for network issues
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const usernameDoc = await getDoc(usernameRef);
        const isAvailable = !usernameDoc.exists();
        console.log('Username check result:', isAvailable);
        return isAvailable;
      } catch (error: any) {
        attempts++;
        if (attempts === maxAttempts) throw error;
        // Wait for 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Failed to check username after multiple attempts');
  } catch (error: any) {
    console.error('Error checking username availability:', {
      error,
      code: error.code,
      message: error.message
    });
    
    // Improved error handling
    if (error.code === 'permission-denied') {
      console.error('Permission denied error details:', error);
      throw new Error('System is temporarily unavailable. Please try again in a few moments.');
    }
    if (error.code === 'unavailable' || error.code === 'resource-exhausted') {
      throw new Error('Service is temporarily unavailable. Please try again in a few moments.');
    }
    if (error.code === 'not-found') {
      return true; // Username is available if the document doesn't exist
    }
    
    throw new Error('Unable to verify username availability. Please try again.');
  }
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'usernames', username.toLowerCase()), {
      userId,
      username,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reserving username:', error);
    throw error;
  }
};

export const releaseUsername = async (username: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'usernames', username.toLowerCase()));
  } catch (error) {
    console.error('Error releasing username:', error);
    throw error;
  }
};

export { auth, app, db };