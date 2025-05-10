import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
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
  disableNetwork as disableFirestoreNetwork,
  enableNetwork as enableFirestoreNetwork,
  connectFirestoreEmulator,
  onSnapshot,
  Unsubscribe,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database, ref, onValue, connectDatabaseEmulator } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Singleton instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseDatabase: Database | null = null;
let isInitialized = false;
let initializationPromise: Promise<any> | null = null;

// Log the config for debugging (without exposing full API key)
console.log('[Firebase] Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
    `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5)}...` : 'missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'missing'
});

// Validate Firebase API key
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.error('[Firebase] API key is missing in environment variables');
}

/**
 * Initialize Firebase services
 * This function ensures Firebase is only initialized once
 */
function initializeFirebase() {
  // If already initialized, return the existing instances
  if (isInitialized && firebaseApp && firebaseDb) {
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage,
      database: firebaseDatabase
    };
  }
  
  // If initialization is in progress, return the promise
  if (initializationPromise) {
    return initializationPromise;
  }
  // Create a promise for the initialization
  initializationPromise = new Promise((resolve) => {
    try {
      // Validate Firebase config with detailed logging
      console.log('[Firebase] Validating configuration...');
      
      // Check for required config values
      const missingConfigValues = Object.entries(firebaseConfig)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      
      if (missingConfigValues.length > 0) {
        console.error('[Firebase] Configuration is incomplete. Missing values for:', missingConfigValues);
        
        // Log specific missing values that are critical
        if (!firebaseConfig.apiKey) console.error('[Firebase] CRITICAL: API key is missing');
        if (!firebaseConfig.projectId) console.error('[Firebase] CRITICAL: Project ID is missing');
        if (!firebaseConfig.databaseURL) console.error('[Firebase] CRITICAL: Database URL is missing - Realtime Database will not work');
        
        throw new Error('Firebase configuration is incomplete. Check your environment variables.');
      }
      
      console.log('[Firebase] Configuration validated successfully');

      // Initialize Firebase app
      // Check if Firebase is already initialized
      if (!getApps().length) {
        console.log('[Firebase] Initializing new Firebase app');
        firebaseApp = initializeApp(firebaseConfig);
        console.log('[Firebase] App initialized successfully');
      } else {
        console.log('[Firebase] App already initialized, reusing existing app');
        firebaseApp = getApps()[0];
      }

      // Initialize services with better error handling
      try {
        console.log('[Firebase] Initializing Auth...');
        firebaseAuth = getAuth(firebaseApp);
        console.log('[Firebase] Auth initialized successfully');
      } catch (authError) {
        console.error('[Firebase] Failed to initialize Auth:', authError);
        throw new Error('Authentication service initialization failed');
      }

      try {
        console.log('[Firebase] Initializing Firestore...');
        firebaseDb = getFirestore(firebaseApp);
        console.log('[Firebase] Firestore initialized successfully');
      } catch (dbError) {
        console.error('[Firebase] Failed to initialize Firestore:', dbError);
        throw new Error('Database service initialization failed');
      }

      try {
        console.log('[Firebase] Initializing Realtime Database with URL:', 
          firebaseConfig.databaseURL ? 
          `${firebaseConfig.databaseURL.substring(0, 8)}...` : 'missing');
        
        if (!firebaseConfig.databaseURL) {
          console.error('[Firebase] CRITICAL: Database URL is missing. Realtime Database will not work properly.');
          throw new Error('Firebase Realtime Database URL is missing. Check your environment variables.');
        }
        
        // Validate database URL format
        try {
          const parsedUrl = new URL(firebaseConfig.databaseURL);
          
          // Check if URL is HTTPS
          if (parsedUrl.protocol !== 'https:') {
            console.error('[Firebase] CRITICAL: Database URL must use HTTPS protocol');
            throw new Error('Firebase database URL must use HTTPS protocol');
          }
          
          // Check if hostname follows Firebase Realtime Database pattern
          if (!parsedUrl.hostname.includes('firebaseio.com')) {
            console.error('[Firebase] CRITICAL: Database URL hostname should contain firebaseio.com');
            throw new Error('Firebase database URL hostname should contain firebaseio.com');
          }
          
          console.log('[Firebase] Database URL format is valid');
        } catch (urlError) {
          console.error('[Firebase] CRITICAL: Database URL is invalid:', urlError);
          throw new Error('Firebase database URL is invalid. It should be in the format https://[project-id]-[hash]-rtdb.firebaseio.com');
        }
        
        // Explicitly pass the databaseURL to ensure it's properly configured
        firebaseDatabase = getDatabase(firebaseApp);
        
        // Verify database connection
        console.log('[Firebase] Realtime Database initialized successfully');
        
        // Add a test connection to verify database is working
        if (typeof window !== 'undefined') {
          try {
            // Use .info/serverTimeOffset instead of .info/connected for initial test
            // This is more reliable for testing actual data access
            const testRef = ref(firebaseDatabase, '.info/serverTimeOffset');
            onValue(testRef, (snapshot) => {
              if (snapshot.exists()) {
                const offset = snapshot.val();
                console.log('[Firebase] Realtime Database connection verified with server time offset:', offset);
              } else {
                console.warn('[Firebase] Realtime Database connection test returned no data');
              }
            }, { onlyOnce: true });
            
            // Also set up the connected listener for ongoing connection status
            const connectedRef = ref(firebaseDatabase, '.info/connected');
            onValue(connectedRef, (snapshot) => {
              const connected = snapshot.val();
              console.log('[Firebase] Realtime Database connection status:', connected ? 'connected' : 'disconnected');
            });
          } catch (connError) {
            console.error('[Firebase] Error testing database connection:', connError);
            // Log more details about the error
            console.error('[Firebase] Database connection error details:', {
              message: connError instanceof Error ? connError.message : 'Unknown error',
              name: connError instanceof Error ? connError.name : 'Unknown error type',
              stack: connError instanceof Error ? connError.stack : 'No stack trace'
            });
          }
        }
      } catch (rtdbError) {
        console.error('[Firebase] Failed to initialize Realtime Database:', rtdbError);
        console.error('[Firebase] Realtime Database error details:', {
          message: rtdbError instanceof Error ? rtdbError.message : 'Unknown error',
          name: rtdbError instanceof Error ? rtdbError.name : 'Unknown error type',
          stack: rtdbError instanceof Error ? rtdbError.stack : 'No stack trace'
        });
        throw new Error('Realtime Database service initialization failed');
      }

      // Only initialize storage in browser environment
      if (typeof window !== 'undefined') {
        try {
          firebaseStorage = getStorage(firebaseApp);
          console.log('[Firebase] Storage initialized successfully');
        } catch (storageError) {
          console.error('[Firebase] Failed to initialize Storage:', storageError);
          // Non-critical, continue without storage
        }
      }

      // Set persistence only in browser environment
      if (typeof window !== 'undefined' && firebaseAuth) {
        setPersistence(firebaseAuth, browserLocalPersistence)
          .then(() => {
            console.log('[Firebase] Auth persistence set to LOCAL');
          })
          .catch(error => {
            console.error('[Firebase] Error setting auth persistence:', error);
            // Non-critical, continue without persistence
          });
      }

      // Enable Firestore persistence for offline support
      if (typeof window !== 'undefined' && firebaseDb) {
        enableIndexedDbPersistence(firebaseDb)
          .then(() => {
            console.log('[Firebase] Firestore persistence enabled');
          })
          .catch((err) => {
            console.warn('[Firebase] Firestore persistence could not be enabled:', err.code);
          });
      }

      isInitialized = true;
      console.log('[Firebase] Services initialized successfully');

      const services = {
        app: firebaseApp,
        auth: firebaseAuth,
        db: firebaseDb,
        storage: firebaseStorage,
        database: firebaseDatabase
      };

      resolve(services);
      return services;
    } catch (error) {
      console.error('[Firebase] Error initializing Firebase:', error);
      
      // Provide more helpful error messages based on the error
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.error('[Firebase] API key is invalid or missing');
        } else if (error.message.includes('project')) {
          console.error('[Firebase] Project ID is invalid or missing');
        } else if (error.message.includes('network')) {
          console.error('[Firebase] Network error while initializing Firebase - check your internet connection');
        }
      }
      
      // Return a partially initialized object to prevent complete app failure
      const services = { 
        app: firebaseApp, 
        auth: firebaseAuth, 
        db: firebaseDb, 
        storage: firebaseStorage, 
        database: firebaseDatabase,
        initializationError: error
      };
      
      resolve(services);
      return services;
    }
  });

  return initializationPromise;
}

/**
 * Get Firebase services
 * Initializes Firebase if not already initialized
 */
export function getFirebaseServices() {
  if (isInitialized && firebaseApp && firebaseDb) {
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage,
      database: firebaseDatabase
    };
  }
  
  // If initialization is in progress, return a promise that resolves to the services
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Otherwise, initialize Firebase
  return initializeFirebase();
}

// Initialize Firebase on module load if in browser environment
if (typeof window !== 'undefined') {
  // Add a global error handler for unhandled Firebase errors
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
      // Handle Firebase errors
      if (event.reason.name === 'FirebaseError') {
        console.error('[Firebase] Unhandled Firebase promise rejection:', event.reason);
        
        // If it's a network error, try to reconnect
        if (event.reason.code === 'failed-precondition' || 
            event.reason.code === 'unavailable' || 
            event.reason.code === 'resource-exhausted') {
          console.log('[Firebase] Network-related error detected, attempting reconnection...');
          
          // If we have a connection manager, trigger reconnection
          if (connectionManager) {
            setTimeout(() => {
              connectionManager.reconnectFirebase();
            }, 2000);
          }
        }
      } 
      // Handle fetch errors which might be related to Firebase
      else if (event.reason.name === 'TypeError' && 
               event.reason.message === 'Failed to fetch' && 
               event.reason.stack && 
               (event.reason.stack.includes('firestore.googleapis.com') || 
                event.reason.stack.includes('Firestore'))) {
        
        console.error('[Firebase] Unhandled fetch error for Firestore:', event.reason);
        
        // If we have a connection manager, trigger reconnection with backoff
        if (connectionManager) {
          console.log('[Firebase] Fetch error detected, attempting reconnection with backoff...');
          setTimeout(() => {
            connectionManager.reconnectFirebase();
          }, 5000);
        }
      }
    }
  });
  
  // Also add a global fetch error handler
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const response = await originalFetch(input, init);
      
      // Check if this is a Firestore-related fetch that failed
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      if (url.includes('firestore.googleapis.com') && !response.ok) {
        console.error(`[Firebase] Firestore request failed with status ${response.status}:`, url);
        
        // Notify the connection manager for 4xx/5xx errors
        if (connectionManager && (response.status >= 400)) {
          connectionManager.handleFetchError(url);
        }
      }
      
      return response;
    } catch (error) {
      // Check if this is a Firestore-related fetch
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      if (url.includes('firestore.googleapis.com')) {
        console.error('[Firebase] Fetch error for Firestore request:', error);
        
        // Notify the connection manager
        if (connectionManager) {
          connectionManager.handleFetchError(url);
        }
      }
      throw error;
    }
  };
  
  // Initialize Firebase immediately
  initializeFirebase();
}

// Connection manager for Firestore and Realtime Database
class FirebaseConnectionManager {
  private isOnline: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private connectionCheckIntervalId: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();
  private lastReconnectTime: number = 0;
  private isReconnecting: boolean = false;
  private connectionErrors: Set<string> = new Set();
  private consecutiveErrors: number = 0;
  private reconnectInProgress: boolean = false;
  private fetchErrorCount: number = 0;
  private lastFetchErrorTime: number = 0;
  
  // Make these properties public to allow external access
  public reconnectFirebase: () => Promise<void>;
  public handleConnectionError: (reason: string) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      
      // Initial connection check
      this.isOnline = navigator.onLine;
      
      // Setup connection monitoring for Realtime Database
      const { database } = getFirebaseServices();
      if (database) {
        try {
          const connectedRef = ref(database, '.info/connected');
          onValue(connectedRef, (snapshot) => {
            const connected = snapshot.val();
            console.log(`[Firebase] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
            
            if (connected) {
              // Reset error counters on successful connection
              this.resetErrorState();
              this.notifyListeners();
            } else if (this.isOnline) {
              // We're online but database is disconnected
              this.handleConnectionError('Database disconnected while browser is online');
            }
          });
        } catch (error) {
          console.error('[Firebase] Error setting up connection monitoring:', error);
        }
      }
      
      // Set up periodic connection check
      this.connectionCheckIntervalId = setInterval(() => {
        this.checkConnection();
      }, 30000); // Check every 30 seconds
    }
  }

  private resetErrorState() {
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.connectionErrors.clear();
    this.fetchErrorCount = 0;
  }
  
  /**
   * Handle a fetch error specifically for Firestore requests
   * This implements a more aggressive circuit breaker for fetch errors
   */
  public handleFetchError(url: string) {
    const now = Date.now();
    this.fetchErrorCount++;
    this.lastFetchErrorTime = now;
    
    console.warn(`[Firebase] Fetch error #${this.fetchErrorCount} for URL: ${url}`);
    
    // If we're getting too many fetch errors in a short period, implement circuit breaker
    if (this.fetchErrorCount > 3) {
      const timeSinceFirstError = now - this.lastFetchErrorTime;
      
      if (timeSinceFirstError < 10000) { // 10 seconds
        console.error(`[Firebase] Multiple fetch errors detected (${this.fetchErrorCount} in ${timeSinceFirstError}ms)`);
        console.log('[Firebase] Implementing circuit breaker for Firestore connections');
        
        // Force disable network for a cooling period
        const { db } = getFirebaseServices();
        if (db) {
          disableFirestoreNetwork(db).then(() => {
            console.log('[Firebase] Firestore network disabled due to fetch errors');
            
            // Schedule re-enable after cooling period
            setTimeout(() => {
              if (this.isOnline) {
                console.log('[Firebase] Attempting to re-enable Firestore network after cooling period');
                enableFirestoreNetwork(db).then(() => {
                  console.log('[Firebase] Firestore network re-enabled after cooling period');
                  this.fetchErrorCount = 0;
                }).catch(error => {
                  console.error('[Firebase] Error re-enabling Firestore network:', error);
                });
              }
            }, 30000); // 30 second cooling period
          }).catch(error => {
            console.error('[Firebase] Error disabling Firestore network:', error);
          });
        }
      }
    }
    
    // Also trigger normal connection error handling
    this.handleConnectionError(`Fetch error for URL: ${url}`);
  }

  private checkConnection = () => {
    // Skip check if we're offline or already reconnecting
    if (!this.isOnline || this.isReconnecting) return;
    
    // If we have database, check connection status
    const { database } = getFirebaseServices();
    if (database) {
      try {
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, (snapshot) => {
          const connected = snapshot.val();
          
          // Only log if disconnected to reduce noise
          if (!connected) {
            console.log('[Firebase] Periodic check: Database disconnected while browser is online');
            this.handleConnectionError('Periodic check failed');
          }
        }, { onlyOnce: true });
      } catch (error) {
        console.error('[Firebase] Error during periodic connection check:', error);
      }
    }
  }

  private handleOnline = () => {
    console.log('[Firebase] Browser went online');
    this.isOnline = true;
    
    // Reset consecutive errors when coming back online
    this.consecutiveErrors = 0;
    
    // Attempt reconnection with a small delay to allow network to stabilize
    setTimeout(() => {
      this.reconnectFirebase();
    }, 1000);
  }

  private handleOffline = () => {
    console.log('[Firebase] Browser went offline');
    this.isOnline = false;
    
    // Disable Firestore network to prevent unnecessary retries
    const { db } = getFirebaseServices();
    if (db) {
      try {
        disableFirestoreNetwork(db).then(() => {
          console.log('[Firebase] Firestore network disabled due to offline status');
        }).catch(error => {
          console.error('[Firebase] Error disabling Firestore network:', error);
        });
      } catch (error) {
        console.error('[Firebase] Error disabling Firestore network:', error);
      }
    }
  }

  private handleConnectionError = (reason: string) => {
    // Track unique error reasons
    this.connectionErrors.add(reason);
    this.consecutiveErrors++;
    
    console.log(`[Firebase] Connection error (${this.consecutiveErrors}): ${reason}`);
    
    // Implement circuit breaker pattern
    if (this.consecutiveErrors > 5 && this.reconnectAttempts > 3) {
      console.warn(`[Firebase] Circuit breaker activated after ${this.consecutiveErrors} consecutive errors`);
      
      // Reset after a longer cooling period
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
      }
      
      this.reconnectTimeoutId = setTimeout(() => {
        console.log('[Firebase] Circuit breaker reset after cooling period');
        this.consecutiveErrors = 0;
        this.reconnectAttempts = 0;
        this.reconnectFirebase();
      }, 300000); // 5 minutes cooling period
      
      return;
    }
    
    // Limit reconnection attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[Firebase] Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      
      // Reset after a longer period to allow future attempts
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
      }
      
      this.reconnectTimeoutId = setTimeout(() => {
        console.log('[Firebase] Resetting reconnect attempts counter after cooling period');
        this.reconnectAttempts = 0;
        this.reconnectFirebase();
      }, 180000); // 3 minutes cooling period
      
      return;
    }

    // Don't attempt reconnection too frequently
    const now = Date.now();
    const timeSinceLastReconnect = now - this.lastReconnectTime;
    
    if (timeSinceLastReconnect < 5000) {
      console.log('[Firebase] Skipping reconnect attempt - too soon since last attempt');
      return;
    }

    this.reconnectAttempts++;
    
    // Clear any existing timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    // Enhanced exponential backoff for reconnect attempts with jitter
    const baseDelay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 2000; // Add up to 2 seconds of jitter
    const delay = Math.min(baseDelay + jitter, 120000); // Cap at 2 minutes
    
    console.log(`[Firebase] Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectFirebase();
    }, delay);
  }

  reconnectFirebase = async () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot reconnect while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Reconnection already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Attempting to reconnect Firebase services...');
    
    try {
      // First disable the network to reset any hanging connections
      const { db } = getFirebaseServices();
      if (db) {
        try {
          // Wrap in try/catch to handle potential network errors during disabling
          try {
            await disableFirestoreNetwork(db);
            console.log('[Firebase] Firestore network disabled for reconnection');
          } catch (disableError) {
            console.warn('[Firebase] Error disabling Firestore network:', disableError);
            // Continue anyway - we'll still try to re-enable
          }
          
          // Short delay to ensure disconnection is complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Then re-enable the network with retry logic
          let enableSuccess = false;
          let retryCount = 0;
          
          while (!enableSuccess && retryCount < 3) {
            try {
              await enableFirestoreNetwork(db);
              console.log('[Firebase] Firestore network re-enabled');
              enableSuccess = true;
              
              // Reset error counters on successful reconnect
              this.resetErrorState();
              this.notifyListeners();
            } catch (enableError) {
              retryCount++;
              console.warn(`[Firebase] Error enabling Firestore network (attempt ${retryCount}/3):`, enableError);
              
              if (retryCount < 3) {
                // Wait before retrying with increasing delay
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
          
          if (!enableSuccess) {
            throw new Error('Failed to re-enable Firestore network after multiple attempts');
          }
        } catch (error) {
          console.error('[Firebase] Error during Firestore reconnection:', error);
          // Don't throw here, just log the error and continue
        }
        
        // Verify connection status after reconnection attempt
        try {
          const connectedRef = ref(firebaseDatabase, '.info/connected');
          onValue(connectedRef, (snapshot) => {
            const connected = snapshot.val();
            console.log(`[Firebase] Connection status after reconnect: ${connected ? 'connected' : 'disconnected'}`);
            
            if (!connected) {
              // If still not connected, schedule another attempt with increased backoff
              this.handleConnectionError('Still disconnected after reconnect attempt');
            }
          }, { onlyOnce: true });
        } catch (verifyError) {
          console.warn('[Firebase] Error verifying connection status:', verifyError);
        }
      }
    } catch (error) {
      console.error('[Firebase] Error during reconnection process:', error);
      // Schedule another attempt if this one failed
      this.handleConnectionError('Reconnection attempt failed');
    } finally {
      // Allow new reconnection attempts after a delay
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 10000); // Increased cooldown period
    }
  }

  public addConnectionListener(listener: () => void): () => void {
    this.listeners.add(listener);
    
    // Return a function to remove the listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[Firebase] Error in connection listener:', error);
      }
    });
  }

  public cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    if (this.connectionCheckIntervalId) {
      clearInterval(this.connectionCheckIntervalId);
    }
    
    this.listeners.clear();
  }
}

// Create and export the connection manager
export const connectionManager = typeof window !== 'undefined' ? new FirebaseConnectionManager() : null;

// Export network control functions
export const disableNetwork = disableFirestoreNetwork;
export const enableNetwork = enableFirestoreNetwork;

// Listener registry
interface ListenerEntry {
  id: string;
  unsubscribe: Unsubscribe;
  timestamp: number;
  path: string;
}

const activeListeners: Map<string, ListenerEntry> = new Map();

/**
 * Register a Firestore listener with automatic cleanup
 */
export function registerListener<T>(
  id: string,
  ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
  callback: (data: any) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  // Remove existing listener with the same ID if it exists
  if (activeListeners.has(id)) {
    console.log(`[Firebase] Removing existing listener with ID: ${id}`);
    removeListener(id);
  }

  // Create new listener with enhanced error handling
  let unsubscribe: Unsubscribe;
  
  try {
    unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        try {
          callback(snapshot);
        } catch (error) {
          console.error(`[Firebase] Error in listener callback (${id}):`, error);
          if (errorCallback) errorCallback(error as Error);
        }
      },
      (error) => {
        console.error(`[Firebase] Error in Firestore listener (${id}):`, error);
        
        // Check if it's a network-related error
        if (error.code === 'failed-precondition' || 
            error.code === 'unavailable' || 
            error.code === 'resource-exhausted' ||
            error.message.includes('network') ||
            error.message.includes('fetch')) {
          
          console.log(`[Firebase] Network-related error in listener ${id}, attempting reconnection...`);
          
          // If we have a connection manager, trigger reconnection
          if (connectionManager) {
            setTimeout(() => {
              connectionManager.reconnectFirebase();
            }, 2000);
          }
        }
        
        if (errorCallback) errorCallback(error);
      }
    );
  } catch (setupError) {
    console.error(`[Firebase] Error setting up listener (${id}):`, setupError);
    
    // Create a no-op unsubscribe function
    unsubscribe = () => {};
    
    // Notify error callback if provided
    if (errorCallback) errorCallback(setupError as Error);
    
    // Return early
    return unsubscribe;
  }

  // Store listener in registry
  const path = ref.path || (ref as any)._query?.path || "unknown-path";
  activeListeners.set(id, {
    id,
    unsubscribe,
    timestamp: Date.now(),
    path
  });

  console.log(`[Firebase] Registered Firestore listener: ${id} for path: ${path}`);
  console.log(`[Firebase] Active listeners count: ${activeListeners.size}`);

  return unsubscribe;
}

/**
 * Remove a specific listener by ID
 */
export function removeListener(id: string): boolean {
  const listener = activeListeners.get(id);
  if (listener) {
    try {
      listener.unsubscribe();
      activeListeners.delete(id);
      console.log(`[Firebase] Removed Firestore listener: ${id}`);
      return true;
    } catch (error) {
      console.error(`[Firebase] Error removing listener ${id}:`, error);
      // Still remove from registry even if unsubscribe fails
      activeListeners.delete(id);
      return false;
    }
  }
  return false;
}

/**
 * Remove all listeners for a specific prefix
 */
export function removeListenersByPrefix(prefix: string): number {
  let count = 0;

  for (const [id, listener] of activeListeners.entries()) {
    if (id.startsWith(prefix)) {
      try {
        listener.unsubscribe();
        activeListeners.delete(id);
        count++;
      } catch (error) {
        console.error(`[Firebase] Error removing listener ${id}:`, error);
        activeListeners.delete(id);
      }
    }
  }

  if (count > 0) {
    console.log(`[Firebase] Removed ${count} listeners with prefix: ${prefix}`);
  }

  return count;
}

/**
 * Remove all active listeners
 */
export function removeAllListeners(): number {
  let count = 0;

  for (const [id, listener] of activeListeners.entries()) {
    try {
      listener.unsubscribe();
      count++;
    } catch (error) {
      console.error(`[Firebase] Error removing listener ${id}:`, error);
    }
  }

  activeListeners.clear();
  console.log(`[Firebase] Removed all ${count} Firestore listeners`);

  return count;
}

/**
 * Get the count of active listeners
 */
export function getActiveListenersCount(): number {
  return activeListeners.size;
}

/**
 * Clean up old listeners that might have been forgotten
 */
export function cleanupStaleListeners(maxAgeMs: number = 3600000): number {
  const now = Date.now();
  let count = 0;

  for (const [id, listener] of activeListeners.entries()) {
    if (now - listener.timestamp > maxAgeMs) {
      try {
        listener.unsubscribe();
        activeListeners.delete(id);
        count++;
      } catch (error) {
        console.error(`[Firebase] Error removing stale listener ${id}:`, error);
        activeListeners.delete(id);
      }
    }
  }

  if (count > 0) {
    console.log(`[Firebase] Cleaned up ${count} stale listeners`);
  }

  return count;
}

// Automatically clean up stale listeners every hour if in browser environment
if (typeof window !== 'undefined') {
  setInterval(() => {
    cleanupStaleListeners();
  }, 3600000); // 1 hour
}