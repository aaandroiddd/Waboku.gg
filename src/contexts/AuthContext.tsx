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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const token = await user.getIdToken();
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const expirationTime = decodedToken.exp * 1000;
            
            if (Date.now() + 5 * 60 * 1000 > expirationTime) {
              await user.getIdToken(true);
            }
          } catch (error) {
            console.error('Token refresh error:', error);
            await signOut();
          }
        }
        setUser(user);
        setLoading(false);
        setInitialized(true);
      });

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
    } catch (error) {
      console.error('Auth initialization error:', error);
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('This username is already taken. Please choose another one.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      try {
        await reserveUsername(username, userCredential.user.uid);
      } catch (error) {
        await userCredential.user.delete();
        throw error;
      }

      try {
        await updateProfile(userCredential.user, {
          displayName: username
        });
      } catch (error) {
        await releaseUsername(username);
        await userCredential.user.delete();
        throw error;
      }

      return { error: null, user: userCredential.user };
    } catch (error: any) {
      console.error('Sign up error:', error);
      let errorMessage = 'An unexpected error occurred';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please try signing in instead.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Please choose a stronger password. It should be at least 6 characters long.';
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

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      
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

  const updateUsername = async (username: string) => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('This username is already taken. Please choose another one.');
      }

      if (user.displayName) {
        await releaseUsername(user.displayName);
      }

      await reserveUsername(username, user.uid);

      await updateProfile(user, {
        displayName: username
      });

      setUser({ ...user });

      return { error: null };
    } catch (error: any) {
      console.error('Update username error:', error);
      return { error: new Error(error.message || 'Failed to update username. Please try again.') };
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUsername }}>
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