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
  
  const admin = getFirebaseAdmin();
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
export function initializeFirebaseAdmin(): typeof admin {
  return getFirebaseAdmin();
}

export function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return {
      admin: firebaseAdmin,
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
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
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
      let processedPrivateKey = privateKey;
      if (!processedPrivateKey) {
        throw new Error('[Firebase Admin] Invalid FIREBASE_PRIVATE_KEY - value is empty or undefined');
      }
      
      // Log the private key format (safely)
      console.log('[Firebase Admin] Private key format check:', {
        length: processedPrivateKey.length,
        hasEscapedNewlines: processedPrivateKey.includes('\\n'),
        hasQuotes: processedPrivateKey.startsWith('"') && processedPrivateKey.endsWith('"'),
        hasSingleQuotes: processedPrivateKey.startsWith("'") && processedPrivateKey.endsWith("'"),
      });
      
      // Remove surrounding quotes if present (sometimes environment variables get quoted)
      if ((processedPrivateKey.startsWith('"') && processedPrivateKey.endsWith('"')) ||
          (processedPrivateKey.startsWith("'") && processedPrivateKey.endsWith("'"))) {
        processedPrivateKey = processedPrivateKey.substring(1, processedPrivateKey.length - 1);
        console.log('[Firebase Admin] Removed surrounding quotes from private key');
      }
      
      // Replace escaped newlines with actual newlines if needed
      if (processedPrivateKey.includes('\\n')) {
        processedPrivateKey = processedPrivateKey.replace(/\\n/g, '\n');
        console.log('[Firebase Admin] Processed private key with escaped newlines');
      }
      
      // Check if the private key has the correct format and fix if needed
      const keyStartMarker = '-----BEGIN PRIVATE KEY-----';
      const keyEndMarker = '-----END PRIVATE KEY-----';
      
      if (!processedPrivateKey.includes(keyStartMarker) || !processedPrivateKey.includes(keyEndMarker)) {
        console.error('[Firebase Admin] Private key is missing required markers');
        
        // Try to request a new environmental variable to be set
        console.error('[Firebase Admin] Requesting new FIREBASE_PRIVATE_KEY to be set');
        
        // Provide a more helpful error message
        throw new Error('Invalid private key format: missing BEGIN/END markers. Please check that your FIREBASE_PRIVATE_KEY environment variable contains a valid private key in PEM format.');
      }
      
      try {
        // Try a more robust approach to fix the private key format
        // First, check if the key is already properly formatted
        if (processedPrivateKey.startsWith(keyStartMarker) && 
            processedPrivateKey.endsWith(keyEndMarker + '\n')) {
          // Key might be properly formatted already, let's verify the structure
          const lines = processedPrivateKey.split('\n');
          const isProperlyFormatted = 
            lines.length > 3 && // At least header, content, and footer
            lines[0] === keyStartMarker && 
            lines[lines.length - 2] === keyEndMarker;
          
          if (isProperlyFormatted) {
            console.log('[Firebase Admin] Private key appears to be properly formatted already');
          } else {
            // Key needs reformatting
            console.log('[Firebase Admin] Private key needs reformatting');
            throw new Error('Key needs reformatting');
          }
        } else {
          // Key definitely needs reformatting
          console.log('[Firebase Admin] Private key definitely needs reformatting');
          throw new Error('Key needs reformatting');
        }
      } catch (error) {
        // Reformat the key to ensure proper PEM format
        console.log('[Firebase Admin] Reformatting private key to proper PEM format');
        
        // Extract just the base64 content between the markers
        const startIndex = processedPrivateKey.indexOf(keyStartMarker) + keyStartMarker.length;
        const endIndex = processedPrivateKey.lastIndexOf(keyEndMarker);
        
        if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
          throw new Error('Invalid private key format: cannot extract content between markers');
        }
        
        let keyContent = processedPrivateKey.substring(startIndex, endIndex).trim();
        
        // Remove any existing line breaks and whitespace in the content
        keyContent = keyContent.replace(/\s/g, '');
        
        // Format the key properly with header, content (in 64-character lines), and footer
        processedPrivateKey = keyStartMarker + '\n';
        
        // Add content in 64-character chunks
        for (let i = 0; i < keyContent.length; i += 64) {
          processedPrivateKey += keyContent.substring(i, Math.min(i + 64, keyContent.length)) + '\n';
        }
        
        // Add the footer
        processedPrivateKey += keyEndMarker + '\n';
        
        console.log('[Firebase Admin] Successfully reformatted private key to proper PEM format');
      }

      try {
        // Create the credential object
        // As a last resort, try to use the original private key if processing failed
        let finalPrivateKey = processedPrivateKey;
        
        // Create the credential
        let credential;
        try {
          credential = admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: finalPrivateKey,
          });
        } catch (certError) {
          console.error('[Firebase Admin] Failed with processed key, trying original key');
          // If the processed key fails, try the original key as a fallback
          finalPrivateKey = privateKey;
          credential = admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: finalPrivateKey,
          });
        }

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
  return {
    admin: firebaseAdmin,
    db: firebaseAdmin.firestore(),
    auth: firebaseAdmin.auth(),
    storage: firebaseAdmin.storage(),
    database: firebaseAdmin.database()
  };
}