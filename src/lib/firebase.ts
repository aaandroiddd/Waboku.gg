import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, getDocs, query, where, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Missing required Firebase configuration keys: ${missingKeys.join(', ')}`);
  }
};

try {
  console.log('Initializing Firebase...');
  validateFirebaseConfig();

  if (!getApps().length) {
    console.log('No existing Firebase app, initializing new one');
    app = initializeApp(firebaseConfig);
  } else {
    console.log('Using existing Firebase app');
    app = getApps()[0];
  }
  
  auth = getAuth(app);
  db = getFirestore(app);

  console.log('Setting auth persistence...');
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Auth persistence set successfully');
    })
    .catch((error) => {
      console.error("Error setting auth persistence:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    });

  console.log('Firebase initialization complete');
} catch (error: any) {
  console.error('Error initializing Firebase:', {
    code: error.code,
    message: error.message,
    stack: error.stack,
    config: {
      ...firebaseConfig,
      apiKey: firebaseConfig.apiKey ? '[REDACTED]' : undefined
    }
  });
  throw new Error('Failed to initialize Firebase. Please check your configuration.');
}

// Username management functions
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  if (!db) throw new Error('Database not initialized');
  
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

    if (error.code === 'permission-denied') {
      throw new Error('Permission denied while checking username availability');
    }

    if (error.code === 'unavailable' || error.code === 'resource-exhausted') {
      throw new Error('Service is temporarily unavailable. Please try again in a moment.');
    }

    throw new Error('Unable to check username availability. Please try again.');
  }
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');
  
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
  if (!db) throw new Error('Database not initialized');
  
  try {
    const normalizedUsername = username.toLowerCase().trim();
    await deleteDoc(doc(db, 'usernames', normalizedUsername));
  } catch (error) {
    console.error('Error releasing username:', error);
    throw error;
  }
};

export { auth, app, db };