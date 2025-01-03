import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth, connectAuthEmulator } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  Firestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Validate environment variables are present
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  experimentalForceLongPolling: true
};

// Configure actionCodeSettings for email verification
export const actionCodeSettings = {
  url: typeof window !== 'undefined' ? `${window.location.origin}/auth/verify-email` : '',
  handleCodeInApp: true
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Enhanced validation with detailed error messages
const validateFirebaseConfig = () => {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const configErrors = requiredKeys.reduce((errors, key) => {
    const value = firebaseConfig[key];
    if (value === undefined || value === null || value.trim() === '') {
      errors.push({
        key,
        error: `Missing or empty value for ${key}`,
        value: value === undefined ? 'undefined' : value === null ? 'null' : 'empty string'
      });
    }
    return errors;
  }, [] as Array<{ key: string; error: string; value: string }>);
  
  if (configErrors.length > 0) {
    const errorMessage = configErrors
      .map(error => `${error.key}: ${error.error}`)
      .join('\n');
    throw new Error(`Firebase configuration errors:\n${errorMessage}`);
  }

  if (!firebaseConfig.apiKey.startsWith('AIza')) {
    throw new Error('Invalid Firebase API key format. API key should start with "AIza"');
  }
};

// Initialize Firebase services
export const getFirebaseServices = () => {
  if (!app) {
    validateFirebaseConfig();
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Configure Firestore settings
    if (typeof window !== 'undefined') {
      db.settings({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      });

      // Enable offline persistence
      enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          enableIndexedDbPersistence(db);
        }
      });

      // Set auth persistence
      setPersistence(auth, browserLocalPersistence);
    }
  }

  return { app, auth, db, storage };
};

// Initialize services on import
getFirebaseServices();

// Enhanced username management functions
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  const { db } = getFirebaseServices();
  if (!username) {
    throw new Error('Username cannot be empty');
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new Error('Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens');
  }

  const normalizedUsername = username.toLowerCase().trim();
  const usernamesRef = collection(db, 'usernames');
  const q = query(usernamesRef, where('username', '==', normalizedUsername));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  const { db } = getFirebaseServices();
  const normalizedUsername = username.toLowerCase().trim();
  await setDoc(doc(db, 'usernames', normalizedUsername), {
    userId,
    username: normalizedUsername,
    originalUsername: username,
    createdAt: new Date().toISOString(),
    lastAction: new Date().toISOString()
  });
};

export const releaseUsername = async (username: string): Promise<void> => {
  const { db } = getFirebaseServices();
  const normalizedUsername = username.toLowerCase().trim();
  await deleteDoc(doc(db, 'usernames', normalizedUsername));
};

export { auth, app, db, storage };