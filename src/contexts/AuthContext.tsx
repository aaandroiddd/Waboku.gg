import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  getIdToken,
  onIdTokenChanged
} from 'firebase/auth';
import { auth, checkUsernameAvailability, reserveUsername, releaseUsername } from '@/lib/firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null, user: User | null }>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<{ error: Error | null }>;
  updateProfile: (data: {
    displayName?: string;
    photoURL?: string;
    bio?: string;
    location?: string;
    contact?: string;
  }) => Promise<{ error: Error | null }>;
  refreshToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Retry mechanism with exponential backoff
  const retryOperation = async <T,>(
    operation: () => Promise<T>,
    attempts = MAX_RETRY_ATTEMPTS
  ): Promise<T> => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (i === attempts - 1) throw error;
        
        const delay = RETRY_DELAY * Math.pow(2, i);
        console.warn(`Operation failed, retrying in ${delay}ms...`, {
          attempt: i + 1,
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry operation failed');
  };

  // Token refresh mechanism
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    try {
      return await retryOperation(async () => {
        const token = await user.getIdToken(true);
        return token;
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }, [user]);

  // Enhanced auth state management
  useEffect(() => {
    let tokenRefreshInterval: NodeJS.Timeout;

    try {
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            if (!navigator.onLine) {
              console.warn('No internet connection detected');
              return;
            }

            await retryOperation(async () => {
              const token = await user.getIdToken();
              const decodedToken = JSON.parse(atob(token.split('.')[1]));
              const expirationTime = decodedToken.exp * 1000;
              
              if (Date.now() + 5 * 60 * 1000 > expirationTime) {
                await user.getIdToken(true);
              }
            });
          } catch (error: any) {
            console.error('Token validation error:', {
              code: error.code,
              message: error.message,
              isOnline: navigator.onLine
            });

            if (error.code === 'auth/network-request-failed' || !navigator.onLine) {
              // Handle offline scenario
              console.log('Operating in offline mode');
            } else {
              await signOut();
            }
          }
        }
        setUser(user);
        setLoading(false);
        setInitialized(true);
      });

      // Token refresh listener
      const unsubscribeToken = onIdTokenChanged(auth, async (user) => {
        if (user) {
          try {
            await user.getIdToken(true);
          } catch (error) {
            console.error('Token refresh error:', error);
          }
        }
      });

      // Set up periodic token refresh
      if (user) {
        tokenRefreshInterval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
      }

      return () => {
        unsubscribeAuth();
        unsubscribeToken();
        if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
      };
    } catch (error) {
      console.error('Auth initialization error:', error);
      setLoading(false);
      setInitialized(true);
    }
  }, [user, refreshToken]);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const isAvailable = await retryOperation(() => 
        checkUsernameAvailability(username)
      );

      if (!isAvailable) {
        throw new Error('This username is already taken. Please choose another one.');
      }

      const userCredential = await retryOperation(() =>
        createUserWithEmailAndPassword(auth, email, password)
      );
      
      try {
        await retryOperation(() =>
          reserveUsername(username, userCredential.user.uid)
        );
      } catch (error) {
        await userCredential.user.delete();
        throw error;
      }

      try {
        await retryOperation(() =>
          updateProfile(userCredential.user, {
            displayName: username
          })
        );
      } catch (error) {
        await releaseUsername(username);
        await userCredential.user.delete();
        throw error;
      }

      return { error: null, user: userCredential.user };
    } catch (error: any) {
      console.error('Sign up error:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });

      const errorMessage = getAuthErrorMessage(error);
      return { 
        error: new Error(errorMessage),
        user: null
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Starting sign in process');
      
      if (!auth) {
        console.error('Auth instance is not initialized');
        throw new Error('Authentication service is not available');
      }

      await retryOperation(() =>
        signInWithEmailAndPassword(auth, email, password)
      );

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      const errorMessage = getAuthErrorMessage(error);
      const errorWithCode = new Error(errorMessage);
      errorWithCode.name = error.code || 'auth/unknown';
      
      return { error: errorWithCode };
    }
  };

  const signOut = async () => {
    try {
      await retryOperation(() => firebaseSignOut(auth));
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const updateUsername = async (username: string) => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      const isAvailable = await retryOperation(() =>
        checkUsernameAvailability(username)
      );

      if (!isAvailable) {
        throw new Error('This username is already taken. Please choose another one.');
      }

      if (user.displayName) {
        await retryOperation(() =>
          releaseUsername(user.displayName)
        );
      }

      await retryOperation(() =>
        reserveUsername(username, user.uid)
      );

      await retryOperation(() =>
        updateProfile(user, {
          displayName: username
        })
      );

      setUser({ ...user });

      return { error: null };
    } catch (error: any) {
      console.error('Update username error:', error);
      return { error: new Error(error.message || 'Failed to update username. Please try again.') };
    }
  };

  // Helper function to get user-friendly error messages
  const getAuthErrorMessage = (error: any): string => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please try signing in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Please choose a stronger password. It should be at least 6 characters long.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/internal-error':
        return 'Authentication service error. Please try again later.';
      case 'auth/configuration-not-found':
      case 'auth/invalid-api-key':
        return 'Authentication service configuration error. Please contact support.';
      default:
        if (error.message?.includes('fetch')) {
          return 'Network error. Please check your internet connection and try again.';
        }
        return 'Failed to authenticate. Please try again.';
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signOut, 
      updateUsername,
      refreshToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}