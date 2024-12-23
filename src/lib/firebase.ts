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

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new Error('Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens');
  }

  try {
    const normalizedUsername = username.toLowerCase().trim();
    const usernameRef = doc(db, 'usernames', normalizedUsername);
    
    // Simple check without retries for better user experience
    const usernameDoc = await getDoc(usernameRef);
    const isAvailable = !usernameDoc.exists();
    
    console.log('Username availability check:', {
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

    // Specific error handling
    switch (error.code) {
      case 'permission-denied':
        throw new Error('Unable to check username. Please try again.');
      case 'unavailable':
      case 'resource-exhausted':
        throw new Error('Service is busy. Please try again in a moment.');
      case 'not-found':
        return true;
      default:
        throw new Error('Unable to check username. Please try again later.');
    }
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