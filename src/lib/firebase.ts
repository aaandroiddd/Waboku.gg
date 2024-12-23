import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

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
  console.log('Starting username availability check for:', username);
  
  if (!username) {
    console.log('Username check failed: Empty username');
    throw new Error('Username cannot be empty');
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    console.log('Username check failed: Invalid format');
    throw new Error('Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens');
  }

  try {
    const normalizedUsername = username.toLowerCase().trim();
    const usernamesRef = collection(db, 'usernames');
    const q = query(usernamesRef, where('username', '==', normalizedUsername));
    
    console.log('Checking username in Firestore:', normalizedUsername);
    
    const querySnapshot = await getDocs(q);
    const isAvailable = querySnapshot.empty;
    
    console.log('Username availability result:', {
      username: normalizedUsername,
      isAvailable,
      timestamp: new Date().toISOString()
    });

    return isAvailable;
  } catch (error: any) {
    console.error('Username check error:', {
      username,
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });

    // More specific error handling
    if (error.code === 'permission-denied') {
      console.log('Permission denied error during username check');
      throw new Error('Permission denied while checking username availability');
    }

    if (error.code === 'unavailable' || error.code === 'resource-exhausted') {
      console.log('Service unavailable error during username check');
      throw new Error('Service is temporarily unavailable. Please try again in a moment.');
    }

    console.log('Generic error during username check:', error.message);
    throw new Error('Unable to check username availability. Please try again.');
  }
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    await setDoc(doc(db, 'usernames', normalizedUsername), {
      userId,
      username: normalizedUsername,
      originalUsername: username,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reserving username:', error);
    throw error;
  }
};

export const releaseUsername = async (username: string): Promise<void> => {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    await deleteDoc(doc(db, 'usernames', normalizedUsername));
  } catch (error) {
    console.error('Error releasing username:', error);
    throw error;
  }
};

export { auth, app, db };