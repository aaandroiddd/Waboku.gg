import * as admin from 'firebase-admin';

let firebaseAdmin: typeof admin | null = null;
let adminApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin app and return both the admin instance and the app
 */
export function initializeAdminApp() {
  if (adminApp) {
    return { admin: firebaseAdmin as typeof admin, app: adminApp };
  }
  
  const { admin } = getFirebaseAdmin();
  adminApp = admin.app();
  
  return { admin, app: adminApp };
}

/**
 * Initialize Firebase Admin and return the admin instance
 */
export function initAdmin(): typeof admin {
  return getFirebaseAdmin();
}

/**
 * Initialize Firebase Admin SDK
 * This is the function used by API routes
 */
export function initializeFirebaseAdmin() {
  return getFirebaseAdmin();
}

// Export database directly for convenience
export const database = getFirebaseAdmin().database;

// Export Firestore database directly for convenience
export const adminDb = getFirebaseAdmin().db;

/**
 * Verify Firebase ID token
 */
export async function verifyIdToken(idToken: string) {
  try {
    console.log('verifyIdToken: Starting token verification');
    const { auth } = getFirebaseAdmin();
    console.log('verifyIdToken: Got Firebase Admin auth instance');
    const result = await auth.verifyIdToken(idToken);
    console.log('verifyIdToken: Token verification successful for user:', result.uid);
    return result;
  } catch (error: any) {
    console.error('verifyIdToken: Token verification failed:', {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    throw error;
  }
}

export function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return {
      admin: firebaseAdmin,
      firestore: firebaseAdmin.firestore,
      db: firebaseAdmin.firestore(),
      auth: firebaseAdmin.auth(),
      storage: firebaseAdmin.storage(),
      database: firebaseAdmin.database()
    };
  }

  if (!admin.apps.length) {
    try {
      // Get project ID from environment variables with fallback
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      
      // Validate required environment variables
      const requiredEnvVars = {
        projectId,
        clientEmail,
        privateKey,
        storageBucket,
      };
      
      // Check if API key is configured (for client-side auth)
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        console.warn('[Firebase Admin] NEXT_PUBLIC_FIREBASE_API_KEY is missing - client-side auth may fail');
      }

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        console.error('[Firebase Admin] Missing required environment variables:', missingVars);
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      // Log initialization attempt (without exposing sensitive data)
      console.log('[Firebase Admin] Initializing with config:', {
        projectId,
        clientEmail: clientEmail?.substring(0, 5) + '...',
        hasPrivateKey: !!privateKey,
        privateKeyLength: privateKey ? privateKey.length : 0,
        databaseURL: databaseURL || '(not provided)',
        storageBucket,
      });

      // Handle private key properly - it might be encoded with escaped newlines
      if (!privateKey) {
        throw new Error('[Firebase Admin] Invalid FIREBASE_PRIVATE_KEY - value is empty or undefined');
      }
      
      // Log the private key format (safely)
      console.log('[Firebase Admin] Private key format check:', {
        length: privateKey.length,
        hasEscapedNewlines: privateKey.includes('\\n'),
        hasQuotes: privateKey.startsWith('"') && privateKey.endsWith('"'),
        hasSingleQuotes: privateKey.startsWith("'") && privateKey.endsWith("'"),
      });
      
      // SIMPLIFIED PRIVATE KEY HANDLING
      // Step 1: Remove surrounding quotes if present
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
          (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
        console.log('[Firebase Admin] Removed surrounding quotes from private key');
      }
      
      // Step 2: Replace escaped newlines with actual newlines
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('[Firebase Admin] Replaced escaped newlines in private key');
      }
      
      // Step 3: Basic validation of key format
      const keyStartMarker = '-----BEGIN PRIVATE KEY-----';
      const keyEndMarker = '-----END PRIVATE KEY-----';
      
      if (!privateKey.includes(keyStartMarker) || !privateKey.includes(keyEndMarker)) {
        console.error('[Firebase Admin] Private key is missing required markers');
        throw new Error('Invalid private key format: missing BEGIN/END markers. Please check your FIREBASE_PRIVATE_KEY environment variable.');
      }
      
      console.log('[Firebase Admin] Private key format appears valid');

      try {
        // Create the credential
        const credential = admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        });

        // Prepare the initialization options
        const options: admin.AppOptions = {
          credential,
          storageBucket,
        };

        // Add databaseURL only if it exists
        if (databaseURL) {
          options.databaseURL = databaseURL;
        }

        // Initialize the app with the credentials
        admin.initializeApp(options);
        console.log('[Firebase Admin] Successfully initialized Firebase Admin SDK');
      } catch (certError: any) {
        console.error('[Firebase Admin] Credential certification error:', {
          message: certError.message,
          name: certError.name,
          code: certError.code,
          stack: certError.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // Provide more detailed error information
        if (certError.message.includes('Failed to parse private key')) {
          console.error('[Firebase Admin] Private key parsing failed. Key format may be incorrect.');
          console.log('[Firebase Admin] Key format details:', {
            startsWithMarker: privateKey.trim().startsWith(keyStartMarker),
            endsWithMarker: privateKey.trim().endsWith(keyEndMarker),
            lineCount: privateKey.split('\n').length,
            firstLine: privateKey.split('\n')[0],
            lastLine: privateKey.split('\n')[privateKey.split('\n').length - 2] // -2 to account for potential trailing newline
          });
        }
        
        throw new Error(`Failed to create Firebase Admin credential: ${certError.message}`);
      }
    } catch (error: any) {
      console.error('[Firebase Admin] Initialization error:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        cause: error.cause,
        name: error.name,
        code: error.code,
        // Environment variable diagnostics (without exposing values)
        envDiagnostics: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasPublicProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
          hasStorageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          hasDatabaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        }
      });
      throw error;
    }
  } else {
    console.log('[Firebase Admin] Using existing Firebase Admin app');
  }

  firebaseAdmin = admin;
  
  // Add error handling for Firestore initialization
  try {
    const db = firebaseAdmin.firestore();
    // Test the connection
    console.log('[Firebase Admin] Firestore initialized successfully');
    
    return {
      admin: firebaseAdmin,
      firestore: firebaseAdmin.firestore,
      db,
      auth: firebaseAdmin.auth(),
      storage: firebaseAdmin.storage(),
      database: firebaseAdmin.database()
    };
  } catch (firestoreError: any) {
    console.error('[Firebase Admin] Firestore initialization error:', {
      message: firestoreError.message,
      code: firestoreError.code,
      name: firestoreError.name
    });
    
    // Still return the admin instance but log the error
    return {
      admin: firebaseAdmin,
      firestore: firebaseAdmin.firestore,
      db: firebaseAdmin.firestore(),
      auth: firebaseAdmin.auth(),
      storage: firebaseAdmin.storage(),
      database: firebaseAdmin.database()
    };
  }
}