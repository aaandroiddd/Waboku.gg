import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, checkUsernameAvailability, reserveUsername, releaseUsername } from '@/lib/firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null, user: User | null }>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Force token refresh if it's close to expiration
        try {
          const token = await user.getIdToken();
          const decodedToken = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = decodedToken.exp * 1000;
          
          // If token is about to expire in the next 5 minutes, refresh it
          if (Date.now() + 5 * 60 * 1000 > expirationTime) {
            await user.getIdToken(true);
          }
        } catch (error) {
          console.error('Token refresh error:', error);
          // If token refresh fails, force re-authentication
          await signOut();
        }
      }
      setUser(user);
      setLoading(false);
    });

    // Set up periodic token refresh (every 30 minutes)
    const refreshInterval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await currentUser.getIdToken(true);
        } catch (error) {
          console.error('Periodic token refresh error:', error);
          await signOut();
        }
      }
    }, 30 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, retryCount = 0) => {
    try {
      console.log('Starting sign up process for:', email);
      
      // Check username availability first
      try {
        const isAvailable = await checkUsernameAvailability(username);
        if (!isAvailable) {
          throw new Error('This username is already taken. Please choose another one.');
        }
      } catch (error: any) {
        console.error('Username check error:', error);
        if (error.code === 'permission-denied') {
          throw new Error('Unable to check username availability. Please try again later.');
        }
        throw error;
      }

      // Add timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
      });
      
      // Create new account directly
      const createAccountPromise = createUserWithEmailAndPassword(auth, email, password);
      
      // Race between the actual request and timeout
      const userCredential = await Promise.race([createAccountPromise, timeoutPromise])
        .catch(async (error) => {
          console.error('Error during sign up:', error);
          if (error.message === 'Request timeout' || error.code === 'auth/network-request-failed') {
            if (retryCount < 3) {
              console.log(`Retrying sign up attempt ${retryCount + 1}/3...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              return signUp(email, password, username, retryCount + 1);
            }
            throw new Error('Network connection error. Please check your internet connection and try again.');
          }
          throw error;
        });

      if (!userCredential || !userCredential.user) {
        throw new Error('Failed to create account. Please try again.');
      }

      // Reserve the username with retry mechanism
      try {
        await reserveUsername(username, userCredential.user.uid);
      } catch (error: any) {
        console.error('Username reservation error:', error);
        
        // If username reservation fails, delete the created account to maintain consistency
        try {
          await userCredential.user.delete();
        } catch (deleteError) {
          console.error('Error deleting user after username reservation failure:', deleteError);
        }

        if (error.code === 'permission-denied') {
          throw new Error('Unable to reserve username. Please try again later.');
        }
        throw error;
      }

      // Set the username
      try {
        await updateProfile(userCredential.user, {
          displayName: username
        });
      } catch (error: any) {
        console.error('Profile update error:', error);
        // If profile update fails, attempt to clean up
        try {
          await releaseUsername(username);
          await userCredential.user.delete();
        } catch (cleanupError) {
          console.error('Cleanup error after profile update failure:', cleanupError);
        }
        throw new Error('Failed to set username. Please try again.');
      }

      console.log('Sign up successful:', userCredential.user);
      return { error: null, user: userCredential.user };
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle network errors with retry mechanism
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying sign up attempt ${retryCount + 1}/2...`);
        // Wait for 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return signUp(email, password, username, retryCount + 1);
      }
      
      // Map Firebase error codes to user-friendly messages
      let errorMessage = 'An unexpected error occurred';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please try signing in instead.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled. Please contact support.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Please choose a stronger password. It should be at least 6 characters long.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
          break;
        default:
          errorMessage = error.message || 'Failed to create account. Please try again.';
      }
      
      return { 
        error: new Error(errorMessage),
        user: null
      };
    }
  };

  const updateUsername = async (username: string) => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      // Check username availability
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('This username is already taken. Please choose another one.');
      }

      // Release old username if exists
      if (user.displayName) {
        await releaseUsername(user.displayName);
      }

      // Reserve new username
      await reserveUsername(username, user.uid);

      // Update profile
      await updateProfile(user, {
        displayName: username
      });

      // Force refresh the user object
      setUser({ ...user });

      return { error: null };
    } catch (error: any) {
      console.error('Update username error:', error);
      return { error: new Error(error.message || 'Failed to update username. Please try again.') };
    }
  };

  const signIn = async (email: string, password: string, retryCount = 0) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Handle network errors with retry mechanism
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying sign in attempt ${retryCount + 1}/2...`);
        // Wait for 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return signIn(email, password, retryCount + 1);
      }
      
      // Map Firebase error codes to user-friendly messages
      let errorMessage = 'An unexpected error occurred';
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
          break;
        default:
          errorMessage = 'Failed to sign in. Please try again.';
      }
      
      return { error: new Error(errorMessage) };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUsername }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}