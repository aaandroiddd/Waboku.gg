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
        
        // Add a test connection to verify database is working (one-time only)
        if (typeof window !== 'undefined') {
          try {
            // Use .info/serverTimeOffset for initial test (one-time read only)
            const testRef = ref(firebaseDatabase, '.info/serverTimeOffset');
            onValue(testRef, (snapshot) => {
              if (snapshot.exists()) {
                const offset = snapshot.val();
                console.log('[Firebase] Realtime Database connection verified with server time offset:', offset);
              } else {
                console.warn('[Firebase] Realtime Database connection test returned no data');
              }
            }, { onlyOnce: true });
            
            // DO NOT set up persistent .info/connected listener here
            // This was causing continuous downloads even when no users were active
            // Connection monitoring should only be enabled when users are authenticated
            console.log('[Firebase] Skipping persistent connection monitoring to reduce database usage');
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
  // Initialize Firestore session management
  import('./firestore-session-manager').then(({ initializeFirestoreSessionManagement }) => {
    initializeFirestoreSessionManagement();
  }).catch(error => {
    console.error('[Firebase] Error initializing Firestore session management:', error);
  });

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
      // Handle fetch errors which might be related to Firebase Auth token service
      else if (event.reason.name === 'TypeError' && 
               event.reason.message === 'Failed to fetch' && 
               event.reason.stack && 
               event.reason.stack.includes('securetoken.googleapis.com')) {
        
        console.error('[Firebase] Unhandled fetch error for Firebase Auth token service:', event.reason);
        
        // This is specifically the error we're trying to fix
        if (connectionManager) {
          console.log('[Firebase] Auth token service fetch error detected, implementing auth session reset...');
          setTimeout(() => {
            connectionManager.forceAuthSessionReset();
          }, 1000);
        }
      }
      // Handle fetch errors which might be related to Firestore - ENHANCED FOR LISTEN CHANNEL ERRORS
      else if (event.reason.name === 'TypeError' && 
               event.reason.message === 'Failed to fetch' && 
               event.reason.stack && 
               (event.reason.stack.includes('firestore.googleapis.com') || 
                event.reason.stack.includes('Firestore'))) {
        
        console.error('[Firebase] CRITICAL: Unhandled fetch error for Firestore detected:', event.reason);
        console.error('[Firebase] Error stack trace:', event.reason.stack);
        
        // Check if this is specifically a Listen channel error
        const isListenChannelError = event.reason.stack.includes('/Listen/channel');
        
        if (isListenChannelError) {
          console.error('[Firebase] CRITICAL: Listen channel error detected in unhandled rejection handler');
          console.error('[Firebase] This is the main error we are trying to fix');
          
          // Prevent the default unhandled rejection behavior for Listen channel errors
          event.preventDefault();
          
          // Implement immediate and aggressive recovery for Listen channel errors
          if (connectionManager) {
            console.log('[Firebase] Implementing immediate Listen channel recovery via connection manager...');
            setTimeout(() => {
              connectionManager.handleListenChannelError('unhandled-rejection', 0);
            }, 10); // Immediate response
          } else {
            console.error('[Firebase] Connection manager not available, implementing direct recovery...');
            
            // Direct recovery without connection manager
            const { db } = getFirebaseServices();
            if (db) {
              console.log('[Firebase] Attempting direct Firestore recovery for Listen channel error');
              
              // Remove all listeners first
              removeAllListeners();
              
              // Disable network
              disableFirestoreNetwork(db).then(() => {
                console.log('[Firebase] Firestore network disabled for Listen channel recovery');
                
                // Clear caches
                if (typeof window !== 'undefined') {
                  try {
                    // Clear Firestore-related localStorage
                    Object.keys(localStorage).forEach(key => {
                      if (key.includes('firestore') || key.includes('fs_')) {
                        localStorage.removeItem(key);
                      }
                    });
                    
                    // Clear IndexedDB
                    const deleteRequest = indexedDB.deleteDatabase('firestore/[DEFAULT]/main');
                    deleteRequest.onsuccess = () => {
                      console.log('[Firebase] Cleared Firestore IndexedDB cache');
                    };
                  } catch (cacheError) {
                    console.error('[Firebase] Error clearing caches:', cacheError);
                  }
                }
                
                // Wait before re-enabling
                setTimeout(() => {
                  enableFirestoreNetwork(db).then(() => {
                    console.log('[Firebase] Firestore network re-enabled after Listen channel recovery');
                  }).catch(err => {
                    console.error('[Firebase] Error re-enabling network after Listen channel recovery:', err);
                  });
                }, 3000);
              }).catch(err => {
                console.error('[Firebase] Error disabling network after Listen channel error:', err);
              });
            } else {
              console.error('[Firebase] No Firestore instance available for recovery');
            }
          }
        } else {
          // For other Firestore errors, use standard reconnection with backoff
          console.log('[Firebase] Non-Listen channel Firestore error, attempting standard reconnection...');
          
          if (connectionManager) {
            setTimeout(() => {
              connectionManager.reconnectFirebase();
            }, 5000);
          }
        }
      }
    }
  });
  
  // Enhanced global fetch error handler with session ID management and Firebase Auth token errors
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const response = await originalFetch(input, init);
      
      // Check if this is a Firebase-related fetch that failed
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      
      // Handle Firebase Auth token service errors
      if (url.includes('securetoken.googleapis.com') && !response.ok) {
        console.error(`[Firebase] Auth token service request failed with status ${response.status}:`, url);
        
        if (response.status === 400) {
          console.warn('[Firebase] Detected 400 Bad Request error from token service - likely stale session');
          
          // For token service errors, force a complete auth session reset
          if (connectionManager) {
            setTimeout(() => {
              connectionManager.forceAuthSessionReset();
            }, 100);
          }
        } else if (response.status >= 500) {
          console.warn('[Firebase] Token service server error, will retry with backoff');
          
          if (connectionManager) {
            connectionManager.handleAuthTokenError(url, response.status);
          }
        }
      }
      
      // Handle Firestore errors
      if (url.includes('firestore.googleapis.com') && !response.ok) {
        console.error(`[Firebase] Firestore request failed with status ${response.status}:`, url);
        
        // Special handling for 400 Bad Request errors with "Unknown SID"
        if (response.status === 400) {
          console.warn('[Firebase] Detected 400 Bad Request error - likely stale session ID');
          
          // Read response body to check for specific error messages
          try {
            const responseText = await response.clone().text();
            if (responseText.includes('Unknown SID') || responseText.includes('Bad Request')) {
              console.warn('[Firebase] Confirmed stale session ID error, forcing complete session reset');
              
              if (connectionManager) {
                // Force immediate and complete session reset for Unknown SID errors
                setTimeout(() => {
                  connectionManager.forceCompleteSessionReset();
                }, 50);
              }
            }
          } catch (readError) {
            console.warn('[Firebase] Could not read response body for error details:', readError);
            
            // Still force session reset for any 400 error on Firestore
            if (connectionManager) {
              setTimeout(() => {
                connectionManager.forceSessionReset();
              }, 100);
            }
          }
        }
        // Special handling for Write channel errors (common after Stripe checkout)
        else if (url.includes('/Write/channel') && response.status === 400) {
          console.warn('[Firebase] Detected Firestore Write channel error, attempting immediate reconnection');
          
          if (connectionManager) {
            // Force immediate reconnection for Write channel errors
            setTimeout(() => {
              connectionManager.forceSessionReset();
            }, 100);
          }
        }
        // Special handling for Listen channel errors
        else if (url.includes('/Listen/channel')) {
          console.warn('[Firebase] Detected Firestore Listen channel error, implementing recovery strategy');
          
          if (connectionManager) {
            // For Listen channel errors, implement a specialized recovery strategy
            setTimeout(() => {
              connectionManager.handleListenChannelError(url, response.status);
            }, 50);
          }
        }
        // Notify the connection manager for 4xx/5xx errors
        else if (connectionManager && (response.status >= 400)) {
          connectionManager.handleFetchError(url);
        }
      }
      
      return response;
    } catch (error) {
      // Check if this is a Firebase-related fetch
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      
      // Handle Firebase Auth token service fetch errors
      if (url.includes('securetoken.googleapis.com')) {
        console.error('[Firebase] Fetch error for Auth token service request:', error);
        
        if (connectionManager) {
          connectionManager.handleAuthTokenError(url, 0); // 0 indicates network error
        }
      }
      // Handle Firestore fetch errors
      else if (url.includes('firestore.googleapis.com')) {
        console.error('[Firebase] Fetch error for Firestore request:', error);
        
        // Special handling for Listen channel fetch errors - this is the main issue we're fixing
        if (url.includes('/Listen/channel')) {
          console.error('[Firebase] CRITICAL: Listen channel fetch error detected - implementing immediate recovery');
          console.error('[Firebase] Listen channel error details:', {
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace'
          });
          
          if (connectionManager) {
            // Immediate recovery for Listen channel fetch errors
            setTimeout(() => {
              connectionManager.handleListenChannelError(url, 0);
            }, 10); // Reduced delay for immediate response
          } else {
            // Fallback if connection manager is not available
            console.error('[Firebase] Connection manager not available, implementing fallback recovery');
            setTimeout(() => {
              // Direct recovery without connection manager
              const { db } = getFirebaseServices();
              if (db) {
                console.log('[Firebase] Attempting direct Firestore network reset for Listen channel error');
                disableFirestoreNetwork(db).then(() => {
                  console.log('[Firebase] Firestore network disabled for Listen channel recovery');
                  setTimeout(() => {
                    enableFirestoreNetwork(db).then(() => {
                      console.log('[Firebase] Firestore network re-enabled after Listen channel recovery');
                    }).catch(enableError => {
                      console.error('[Firebase] Error re-enabling Firestore network:', enableError);
                    });
                  }, 3000);
                }).catch(disableError => {
                  console.error('[Firebase] Error disabling Firestore network:', disableError);
                });
              }
            }, 100);
          }
        }
        // Special handling for Write channel errors
        else if (url.includes('/Write/channel')) {
          console.warn('[Firebase] Detected Firestore Write channel error in catch block, attempting immediate reconnection');
          
          if (connectionManager) {
            // Force immediate reconnection for Write channel errors
            setTimeout(() => {
              connectionManager.forceSessionReset();
            }, 100);
          }
        }
        // Notify the connection manager
        else if (connectionManager) {
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
  public forceSessionReset: () => Promise<void>;
  public forceAuthSessionReset: () => Promise<void>;
  public handleAuthTokenError: (url: string, status: number) => void;
  public forceCompleteSessionReset: () => Promise<void>;
  public handleListenChannelError: (url: string, status: number) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      
      // Initial connection check
      this.isOnline = navigator.onLine;
      
      // DO NOT setup persistent connection monitoring here
      // This was causing continuous database downloads even when no users were active
      // Connection monitoring will be enabled only when needed via enableConnectionMonitoring()
      
      console.log('[Firebase] Connection manager initialized without persistent monitoring to reduce database usage');
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
    
    // Check if this is a Listen channel error
    const isListenChannelError = url.includes('/Listen/channel');
    
    console.warn(`[Firebase] Fetch error #${this.fetchErrorCount} for URL: ${url}${isListenChannelError ? ' (Listen channel)' : ''}`);
    
    // Special handling for Listen channel errors
    if (isListenChannelError) {
      console.log('[Firebase] Implementing specialized recovery for Listen channel error');
      
      // For Listen channel errors, we need a more aggressive approach
      const { db } = getFirebaseServices();
      if (db) {
        // First, remove all listeners to prevent them from reconnecting automatically
        removeAllListeners();
        
        // Then disable network to clear any hanging connections
        disableFirestoreNetwork(db).then(() => {
          console.log('[Firebase] Firestore network disabled for Listen channel recovery');
          
          // Clear any cached Firestore data that might be causing issues
          if (typeof window !== 'undefined') {
            try {
              // Clear IndexedDB cache for Firestore
              const request = window.indexedDB.deleteDatabase('firestore/[DEFAULT]/main');
              request.onsuccess = () => {
                console.log('[Firebase] Successfully cleared Firestore IndexedDB cache');
              };
              request.onerror = (event) => {
                console.error('[Firebase] Error clearing Firestore IndexedDB cache:', event);
              };
              
              // Also clear localStorage items related to Firestore
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('firestore') || 
                    key.includes('firestore') || 
                    key.includes('firebase') || 
                    key.includes('fs_')) {
                  localStorage.removeItem(key);
                }
              });
            } catch (error) {
              console.error('[Firebase] Error clearing Firestore cache:', error);
            }
          }
          
          // Wait longer before re-enabling for Listen channel errors
          setTimeout(() => {
            if (this.isOnline) {
              console.log('[Firebase] Attempting to re-enable Firestore network after Listen channel recovery');
              enableFirestoreNetwork(db).then(() => {
                console.log('[Firebase] Firestore network re-enabled after Listen channel recovery');
                this.fetchErrorCount = 0;
                this.resetErrorState();
                this.notifyListeners();
              }).catch(error => {
                console.error('[Firebase] Error re-enabling Firestore network:', error);
              });
            }
          }, 5000); // 5 second cooling period for Listen channel errors
        }).catch(error => {
          console.error('[Firebase] Error disabling Firestore network:', error);
        });
      }
      
      return; // Skip the standard circuit breaker for Listen channel errors
    }
    
    // Standard circuit breaker for other fetch errors
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

  /**
   * Force a complete session reset for Firestore
   * This is more aggressive than reconnectFirebase and is used for 400 errors
   */
  forceSessionReset = async () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot force session reset while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Session reset already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Forcing complete session reset due to stale session ID...');
    
    try {
      // First, remove all listeners to prevent them from reconnecting automatically
      removeAllListeners();
      console.log('[Firebase] Removed all listeners for session reset');
      
      const { db } = getFirebaseServices();
      if (db) {
        try {
          // Disable network to clear any hanging connections
          await disableFirestoreNetwork(db);
          console.log('[Firebase] Firestore network disabled for session reset');
          
          // Clear all Firestore-related cache aggressively
          if (typeof window !== 'undefined') {
            try {
              // Clear IndexedDB for Firestore
              const deleteIDBRequest = indexedDB.deleteDatabase('firestore/[DEFAULT]/main');
              deleteIDBRequest.onsuccess = () => {
                console.log('[Firebase] Cleared Firestore IndexedDB cache for session reset');
              };
              deleteIDBRequest.onerror = (event) => {
                console.error('[Firebase] Error clearing Firestore IndexedDB cache:', event);
              };
              
              // Clear all localStorage items related to Firebase/Firestore
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('firestore') || 
                    key.includes('firestore') || 
                    key.includes('firebase') || 
                    key.includes('fs_') ||
                    key.includes('gapi.') ||
                    key.includes('google.')) {
                  localStorage.removeItem(key);
                }
              });
              
              // Clear sessionStorage as well
              Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('firestore') || 
                    key.includes('firestore') || 
                    key.includes('firebase') || 
                    key.includes('fs_')) {
                  sessionStorage.removeItem(key);
                }
              });
              
              console.log('[Firebase] Cleared all Firebase-related cache for session reset');
            } catch (error) {
              console.error('[Firebase] Error clearing cache during session reset:', error);
            }
          }
          
          // Wait longer for session reset to ensure all connections are cleared
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Re-enable network with retry logic
          let enableSuccess = false;
          let retryCount = 0;
          
          while (!enableSuccess && retryCount < 5) { // More retries for session reset
            try {
              await enableFirestoreNetwork(db);
              console.log('[Firebase] Firestore network re-enabled after session reset');
              enableSuccess = true;
              
              // Reset all error counters on successful session reset
              this.resetErrorState();
              this.notifyListeners();
            } catch (enableError) {
              retryCount++;
              console.warn(`[Firebase] Error enabling Firestore network after session reset (attempt ${retryCount}/5):`, enableError);
              
              if (retryCount < 5) {
                // Wait longer between retries for session reset
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
              }
            }
          }
          
          if (!enableSuccess) {
            console.error('[Firebase] Failed to re-enable Firestore network after session reset');
            // Schedule a regular reconnect attempt as fallback
            setTimeout(() => {
              this.reconnectFirebase();
            }, 10000);
          }
        } catch (error) {
          console.error('[Firebase] Error during session reset:', error);
          // Schedule a regular reconnect attempt as fallback
          setTimeout(() => {
            this.reconnectFirebase();
          }, 5000);
        }
      }
    } catch (error) {
      console.error('[Firebase] Error during session reset process:', error);
      // Schedule a regular reconnect attempt as fallback
      this.handleConnectionError('Session reset failed');
    } finally {
      // Allow new operations after a longer delay for session reset
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 15000); // Longer cooldown for session reset
    }
  }

  /**
   * Force a complete auth session reset for Firebase Auth token errors
   * This is specifically for handling securetoken.googleapis.com errors
   */
  forceAuthSessionReset = async () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot force auth session reset while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Auth session reset already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Forcing complete auth session reset due to token service errors...');
    
    try {
      // Clear all Firebase Auth-related cache aggressively
      if (typeof window !== 'undefined') {
        try {
          // Clear all localStorage items related to Firebase Auth
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('firebase:') || 
                key.includes('firebase') || 
                key.includes('auth') ||
                key.includes('gapi.') ||
                key.includes('google.') ||
                key.startsWith('waboku_')) {
              localStorage.removeItem(key);
            }
          });
          
          // Clear sessionStorage as well
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('firebase:') || 
                key.includes('firebase') || 
                key.includes('auth')) {
              sessionStorage.removeItem(key);
            }
          });
          
          // Clear IndexedDB for Firebase Auth
          const deleteAuthIDBRequest = indexedDB.deleteDatabase('firebase-auth-state');
          deleteAuthIDBRequest.onsuccess = () => {
            console.log('[Firebase] Cleared Firebase Auth IndexedDB cache');
          };
          deleteAuthIDBRequest.onerror = (event) => {
            console.error('[Firebase] Error clearing Firebase Auth IndexedDB cache:', event);
          };
          
          console.log('[Firebase] Cleared all Firebase Auth-related cache for session reset');
        } catch (error) {
          console.error('[Firebase] Error clearing auth cache during session reset:', error);
        }
      }
      
      // Get Firebase services
      const { auth, db } = getFirebaseServices();
      
      // If we have an authenticated user, try to refresh their token
      if (auth && auth.currentUser) {
        try {
          console.log('[Firebase] Attempting to refresh user token after auth session reset');
          
          // Force token refresh with retry logic
          let tokenRefreshSuccess = false;
          let retryCount = 0;
          
          while (!tokenRefreshSuccess && retryCount < 3) {
            try {
              await auth.currentUser.getIdToken(true);
              console.log('[Firebase] User token refreshed successfully after auth session reset');
              tokenRefreshSuccess = true;
            } catch (tokenError) {
              retryCount++;
              console.warn(`[Firebase] Token refresh failed after auth session reset (attempt ${retryCount}/3):`, tokenError);
              
              if (retryCount < 3) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
              }
            }
          }
          
          if (!tokenRefreshSuccess) {
            console.error('[Firebase] Failed to refresh token after auth session reset');
            // Don't throw here, as the user might still be able to continue
          }
        } catch (error) {
          console.error('[Firebase] Error refreshing token during auth session reset:', error);
        }
      }
      
      // Also reset Firestore connections if available
      if (db) {
        try {
          // Disable and re-enable Firestore network to reset connections
          await disableFirestoreNetwork(db);
          console.log('[Firebase] Firestore network disabled for auth session reset');
          
          // Wait before re-enabling
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          await enableFirestoreNetwork(db);
          console.log('[Firebase] Firestore network re-enabled after auth session reset');
        } catch (firestoreError) {
          console.error('[Firebase] Error resetting Firestore network during auth session reset:', firestoreError);
        }
      }
      
      // Reset all error counters on successful auth session reset
      this.resetErrorState();
      this.notifyListeners();
      
      console.log('[Firebase] Auth session reset completed successfully');
    } catch (error) {
      console.error('[Firebase] Error during auth session reset process:', error);
      // Schedule a regular reconnect attempt as fallback
      this.handleConnectionError('Auth session reset failed');
    } finally {
      // Allow new operations after a delay
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 10000);
    }
  }

  /**
   * Handle Firebase Auth token service errors
   * This implements specific handling for securetoken.googleapis.com errors
   */
  handleAuthTokenError = (url: string, status: number) => {
    console.warn(`[Firebase] Auth token error for URL: ${url}, status: ${status}`);
    
    // For network errors (status 0) or server errors (5xx), implement backoff
    if (status === 0 || status >= 500) {
      // Implement exponential backoff for auth token errors
      const now = Date.now();
      const timeSinceLastError = now - this.lastFetchErrorTime;
      
      // If we've had recent errors, increase the backoff
      if (timeSinceLastError < 60000) { // Within last minute
        this.fetchErrorCount++;
        
        if (this.fetchErrorCount > 3) {
          console.warn(`[Firebase] Multiple auth token errors detected, implementing backoff`);
          
          // Disable auth operations temporarily
          const backoffTime = Math.min(30000 * Math.pow(2, this.fetchErrorCount - 3), 300000); // Max 5 minutes
          
          console.log(`[Firebase] Auth token operations backed off for ${backoffTime / 1000} seconds`);
          
          // Schedule a retry after backoff
          setTimeout(() => {
            console.log('[Firebase] Auth token backoff period ended, operations resumed');
            this.fetchErrorCount = 0;
          }, backoffTime);
          
          return;
        }
      } else {
        // Reset error count if it's been a while since last error
        this.fetchErrorCount = 1;
      }
      
      this.lastFetchErrorTime = now;
    }
    
    // For 4xx errors (except 401 which is expected), force auth session reset
    if (status >= 400 && status < 500 && status !== 401) {
      console.warn('[Firebase] Client error in auth token service, forcing auth session reset');
      
      setTimeout(() => {
        this.forceAuthSessionReset();
      }, 1000);
    }
    
    // Also trigger general connection error handling
    this.handleConnectionError(`Auth token error: ${url} (${status})`);
  }

  /**
   * Force a complete session reset with more aggressive cache clearing
   * This is the most aggressive reset method for severe session issues
   */
  forceCompleteSessionReset = async () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot force complete session reset while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Complete session reset already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Forcing COMPLETE session reset with aggressive cache clearing...');
    
    try {
      // First, remove all listeners to prevent them from reconnecting automatically
      removeAllListeners();
      console.log('[Firebase] Removed all listeners for complete session reset');
      
      const { db, auth } = getFirebaseServices();
      
      // Disable Firestore network first
      if (db) {
        try {
          await disableFirestoreNetwork(db);
          console.log('[Firebase] Firestore network disabled for complete session reset');
        } catch (disableError) {
          console.error('[Firebase] Error disabling Firestore network:', disableError);
        }
      }
      
      // Clear ALL browser storage aggressively
      if (typeof window !== 'undefined') {
        try {
          // Clear ALL IndexedDB databases
          const databases = ['firestore/[DEFAULT]/main', 'firestore/[DEFAULT]/metadata', 'firebase-auth-state', 'firebase-messaging-database'];
          
          for (const dbName of databases) {
            try {
              const deleteRequest = indexedDB.deleteDatabase(dbName);
              deleteRequest.onsuccess = () => {
                console.log(`[Firebase] Successfully deleted IndexedDB database: ${dbName}`);
              };
              deleteRequest.onerror = (event) => {
                console.error(`[Firebase] Error deleting IndexedDB database ${dbName}:`, event);
              };
            } catch (error) {
              console.error(`[Firebase] Error setting up deletion for IndexedDB database ${dbName}:`, error);
            }
          }
          
          // Clear ALL localStorage items (not just Firebase-related)
          try {
            localStorage.clear();
            console.log('[Firebase] Cleared all localStorage for complete session reset');
          } catch (error) {
            console.error('[Firebase] Error clearing localStorage:', error);
            
            // Fallback: clear Firebase-related items only
            Object.keys(localStorage).forEach(key => {
              if (key.includes('firebase') || 
                  key.includes('firestore') || 
                  key.includes('google') || 
                  key.includes('gapi') ||
                  key.includes('auth') ||
                  key.startsWith('fs_') ||
                  key.startsWith('waboku_')) {
                localStorage.removeItem(key);
              }
            });
          }
          
          // Clear ALL sessionStorage items
          try {
            sessionStorage.clear();
            console.log('[Firebase] Cleared all sessionStorage for complete session reset');
          } catch (error) {
            console.error('[Firebase] Error clearing sessionStorage:', error);
          }
          
          // Clear service worker caches if available
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(
                cacheNames.map(cacheName => {
                  if (cacheName.includes('firebase') || cacheName.includes('firestore')) {
                    return caches.delete(cacheName);
                  }
                })
              );
              console.log('[Firebase] Cleared Firebase-related service worker caches');
            } catch (error) {
              console.error('[Firebase] Error clearing service worker caches:', error);
            }
          }
          
          console.log('[Firebase] Completed aggressive cache clearing for complete session reset');
        } catch (error) {
          console.error('[Firebase] Error during aggressive cache clearing:', error);
        }
      }
      
      // Force auth token refresh if user is authenticated
      if (auth && auth.currentUser) {
        try {
          console.log('[Firebase] Forcing auth token refresh for complete session reset');
          await auth.currentUser.getIdToken(true);
          console.log('[Firebase] Auth token refreshed successfully');
        } catch (tokenError) {
          console.error('[Firebase] Error refreshing auth token during complete session reset:', tokenError);
        }
      }
      
      // Wait longer for complete session reset
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Re-enable Firestore network with extended retry logic
      if (db) {
        let enableSuccess = false;
        let retryCount = 0;
        
        while (!enableSuccess && retryCount < 7) { // More retries for complete reset
          try {
            await enableFirestoreNetwork(db);
            console.log('[Firebase] Firestore network re-enabled after complete session reset');
            enableSuccess = true;
            
            // Reset all error counters on successful complete session reset
            this.resetErrorState();
            this.notifyListeners();
          } catch (enableError) {
            retryCount++;
            console.warn(`[Firebase] Error enabling Firestore network after complete session reset (attempt ${retryCount}/7):`, enableError);
            
            if (retryCount < 7) {
              // Wait progressively longer between retries
              await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
            }
          }
        }
        
        if (!enableSuccess) {
          console.error('[Firebase] Failed to re-enable Firestore network after complete session reset');
          // Schedule a regular reconnect attempt as fallback
          setTimeout(() => {
            this.reconnectFirebase();
          }, 15000);
        }
      }
      
      console.log('[Firebase] Complete session reset completed successfully');
    } catch (error) {
      console.error('[Firebase] Error during complete session reset process:', error);
      // Schedule a regular reconnect attempt as fallback
      this.handleConnectionError('Complete session reset failed');
    } finally {
      // Allow new operations after an extended delay for complete session reset
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 20000); // Extended cooldown for complete session reset
    }
  }

  /**
   * Handle Listen channel errors specifically
   * This implements specialized recovery for Firestore Listen channel issues
   */
  handleListenChannelError = async (url: string, status: number) => {
    console.warn(`[Firebase] Listen channel error for URL: ${url}, status: ${status}`);
    
    if (!this.isOnline) {
      console.log('[Firebase] Cannot handle Listen channel error while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Listen channel error handling already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Implementing specialized Listen channel error recovery...');
    
    try {
      // First, remove all listeners to prevent them from reconnecting automatically
      removeAllListeners();
      console.log('[Firebase] Removed all listeners for Listen channel recovery');
      
      const { db } = getFirebaseServices();
      if (db) {
        try {
          // Disable network to clear any hanging connections
          await disableFirestoreNetwork(db);
          console.log('[Firebase] Firestore network disabled for Listen channel recovery');
          
          // Clear Firestore-specific cache more aggressively for Listen channel errors
          if (typeof window !== 'undefined') {
            try {
              // Clear Firestore IndexedDB databases
              const firestoreDatabases = [
                'firestore/[DEFAULT]/main',
                'firestore/[DEFAULT]/metadata',
                'firestore_cache'
              ];
              
              for (const dbName of firestoreDatabases) {
                try {
                  const deleteRequest = indexedDB.deleteDatabase(dbName);
                  deleteRequest.onsuccess = () => {
                    console.log(`[Firebase] Successfully cleared Firestore IndexedDB: ${dbName}`);
                  };
                  deleteRequest.onerror = (event) => {
                    console.error(`[Firebase] Error clearing Firestore IndexedDB ${dbName}:`, event);
                  };
                } catch (error) {
                  console.error(`[Firebase] Error setting up Firestore IndexedDB deletion for ${dbName}:`, error);
                }
              }
              
              // Clear Firestore-related localStorage and sessionStorage
              ['localStorage', 'sessionStorage'].forEach(storageType => {
                const storage = window[storageType as 'localStorage' | 'sessionStorage'];
                Object.keys(storage).forEach(key => {
                  if (key.startsWith('firestore') || 
                      key.includes('firestore') || 
                      key.includes('fs_') ||
                      key.includes('listen_') ||
                      key.includes('channel_')) {
                    storage.removeItem(key);
                  }
                });
              });
              
              console.log('[Firebase] Cleared Firestore-specific cache for Listen channel recovery');
            } catch (error) {
              console.error('[Firebase] Error clearing Firestore cache for Listen channel recovery:', error);
            }
          }
          
          // Wait longer for Listen channel recovery to ensure all connections are cleared
          await new Promise(resolve => setTimeout(resolve, 6000));
          
          // Re-enable network with retry logic specific to Listen channel recovery
          let enableSuccess = false;
          let retryCount = 0;
          
          while (!enableSuccess && retryCount < 5) {
            try {
              await enableFirestoreNetwork(db);
              console.log('[Firebase] Firestore network re-enabled after Listen channel recovery');
              enableSuccess = true;
              
              // Reset error counters on successful Listen channel recovery
              this.resetErrorState();
              this.notifyListeners();
            } catch (enableError) {
              retryCount++;
              console.warn(`[Firebase] Error enabling Firestore network after Listen channel recovery (attempt ${retryCount}/5):`, enableError);
              
              if (retryCount < 5) {
                // Wait progressively longer between retries for Listen channel recovery
                await new Promise(resolve => setTimeout(resolve, 2500 * retryCount));
              }
            }
          }
          
          if (!enableSuccess) {
            console.error('[Firebase] Failed to re-enable Firestore network after Listen channel recovery');
            // Escalate to complete session reset for persistent Listen channel issues
            setTimeout(() => {
              this.forceCompleteSessionReset();
            }, 5000);
          }
        } catch (error) {
          console.error('[Firebase] Error during Listen channel recovery:', error);
          // Escalate to complete session reset for severe Listen channel issues
          setTimeout(() => {
            this.forceCompleteSessionReset();
          }, 3000);
        }
      }
      
      console.log('[Firebase] Listen channel error recovery completed');
    } catch (error) {
      console.error('[Firebase] Error during Listen channel error recovery process:', error);
      // Schedule a complete session reset as fallback for Listen channel issues
      this.handleConnectionError('Listen channel error recovery failed');
    } finally {
      // Allow new operations after a delay specific to Listen channel recovery
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 12000); // Extended cooldown for Listen channel recovery
    }
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

// Export individual services for direct access
export const { app, auth, db, storage, database } = (() => {
  if (typeof window !== 'undefined') {
    const services = getFirebaseServices();
    return services;
  }
  // Return empty objects for server-side rendering
  return { app: null, auth: null, db: null, storage: null, database: null };
})();