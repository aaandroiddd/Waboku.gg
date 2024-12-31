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
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Configure actionCodeSettings for email verification
export const actionCodeSettings = {
  url: typeof window !== 'undefined' ? `${window.location.origin}/auth/verify-email` : '',
  handleCodeInApp: true
};

// Log Firebase config for debugging (excluding sensitive data)
console.log('Firebase Config Status:', {
  apiKeyPresent: !!firebaseConfig.apiKey,
  authDomainPresent: !!firebaseConfig.authDomain,
  projectIdPresent: !!firebaseConfig.projectId,
  storageBucketPresent: !!firebaseConfig.storageBucket,
  messagingSenderIdPresent: !!firebaseConfig.messagingSenderId,
  appIdPresent: !!firebaseConfig.appId
});

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

  console.log('Validating Firebase configuration...');

  // Check for undefined or empty string values with detailed feedback
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
    console.error('Firebase configuration validation failed:', {
      errors: configErrors,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Firebase configuration errors:\n${errorMessage}`);
  }

  // Enhanced API key validation
  if (!firebaseConfig.apiKey.startsWith('AIza')) {
    console.error('Firebase API key validation failed:', {
      error: 'Invalid API key format',
      keyPresent: !!firebaseConfig.apiKey,
      timestamp: new Date().toISOString()
    });
    throw new Error('Invalid Firebase API key format. API key should start with "AIza"');
  }

  console.log('Firebase configuration validation successful');
};

// Exponential backoff retry mechanism
const retry = async (
  operation: () => Promise<any>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<any> => {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (attempt === maxAttempts - 1) break;
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Operation failed, retrying in ${delay}ms...`, {
        attempt: attempt + 1,
        maxAttempts,
        error: error.message
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const initializeFirebase = async () => {
  try {
    console.log('Initializing Firebase...');
    // Add detailed logging for API initialization
    console.log('Firebase API Status:', {
      apiKey: firebaseConfig.apiKey ? 'Present' : 'Missing',
      timestamp: new Date().toISOString()
    });
    validateFirebaseConfig();

    // Additional validation for storage bucket
    if (!firebaseConfig.storageBucket || firebaseConfig.storageBucket.trim() === '') {
      throw new Error('Storage bucket configuration is missing or empty');
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('Skipping Firebase initialization in non-browser environment');
      return { app: null, auth: null, db: null, storage: null };
    }

    // Initialize Firebase app if it hasn't been initialized yet
    if (!getApps().length) {
      console.log('No existing Firebase app, initializing new one');
      app = initializeApp(firebaseConfig);
    } else {
      console.log('Using existing Firebase app');
      app = getApps()[0];
    }

    // Initialize services with retry mechanism
    auth = await retry(() => getAuth(app));
    db = await retry(() => getFirestore(app));
    storage = await retry(() => getStorage(app));

    // Configure Firestore settings and persistence
    if (typeof window !== 'undefined') {
      try {
        // Enable offline persistence with unlimited cache size
        await retry(() => 
          enableMultiTabIndexedDbPersistence(db)
            .catch((err) => {
              if (err.code === 'failed-precondition') {
                // Multiple tabs open, fallback to single-tab persistence
                return enableIndexedDbPersistence(db);
              } else if (err.code === 'unimplemented') {
                console.warn('Browser doesn\'t support persistence');
              }
              throw err;
            })
        );

        // Configure Firestore settings
        db.settings({
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
          experimentalForceLongPolling: true,
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true
        });

        console.log('Firestore persistence and settings configured successfully');
      } catch (e) {
        console.warn('Firestore persistence initialization error:', e);
      }

      // Set auth persistence with retry
      await retry(() => 
        setPersistence(auth, browserLocalPersistence)
      );
    }
    
    console.log('Firebase initialization complete');
    return { app, auth, db, storage };
  } catch (error: any) {
    console.error('Firebase initialization failed:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to initialize Firebase: ${error.message}`);
  }
};

// Initialize Firebase with async/await
let initialized = false;
const initializeFirebaseAsync = async () => {
  if (!initialized) {
    const { app: initializedApp, auth: initializedAuth, db: initializedDb, storage: initializedStorage } = 
      await initializeFirebase();
    app = initializedApp;
    auth = initializedAuth;
    db = initializedDb;
    storage = initializedStorage;
    initialized = true;
  }
  return { app, auth, db, storage };
};

// Enhanced username management functions with retry mechanism
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  if (!db) throw new Error('Database not initialized');
  
  console.log('Starting username availability check for:', username);
  
  if (!username) {
    console.log('Username check failed: Empty username');
    throw new Error('Username cannot be empty');
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    console.log('Username check failed: Invalid format');
    throw new Error('Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens');
  }

  return retry(async () => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      const usernamesRef = collection(db, 'usernames');
      const q = query(usernamesRef, where('username', '==', normalizedUsername));
      
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

      throw error;
    }
  });
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');
  
  return retry(async () => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      await setDoc(doc(db, 'usernames', normalizedUsername), {
        userId,
        username: normalizedUsername,
        originalUsername: username,
        createdAt: new Date().toISOString(),
        lastAction: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error reserving username:', error);
      throw error;
    }
  });
};

export const releaseUsername = async (username: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');
  
  return retry(async () => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      await deleteDoc(doc(db, 'usernames', normalizedUsername));
    } catch (error) {
      console.error('Error releasing username:', error);
      throw error;
    }
  });
};

// Initialize Firebase asynchronously and export a promise that resolves when initialization is complete
const initializationPromise = initializeFirebaseAsync().catch(console.error);

// Export the initialization promise along with the services
export { auth, app, db, storage, initializationPromise };