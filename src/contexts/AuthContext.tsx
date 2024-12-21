import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null, isUnverified?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null, user: User | null, isExisting?: boolean }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, retryCount = 0) => {
    try {
      console.log('Starting sign up process for:', email);
      
      // Add timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
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
              return signUp(email, password, retryCount + 1);
            }
            throw new Error('Network connection error. Please check your internet connection and try again.');
          }
          throw error;
        });

      console.log('Sign up successful:', userCredential.user);
      return { error: null, user: userCredential.user };
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle network errors with retry mechanism
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying sign up attempt ${retryCount + 1}/2...`);
        // Wait for 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return signUp(email, password, retryCount + 1);
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

  const signIn = async (email: string, password: string, retryCount = 0) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        // Send a new verification email
        await sendEmailVerification(userCredential.user, {
          url: window.location.origin + '/dashboard',
          handleCodeInApp: false,
        });
        // Sign out the user since email is not verified
        await firebaseSignOut(auth);
        return { error: new Error('Please verify your email address. A new verification email has been sent.') };
      }
      
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

  const resendVerificationEmail = async (email: string) => {
    try {
      // Check if email exists first
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length === 0) {
        return { error: new Error('No account found with this email address.') };
      }

      // Get current user if logged in
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        if (currentUser.email === email) {
          // If the user is already logged in and it's the same email
          if (!currentUser.emailVerified) {
            await sendEmailVerification(currentUser, {
              url: window.location.origin + '/dashboard',
              handleCodeInApp: false,
            });
            return { error: null };
          } else {
            return { error: new Error('This email is already verified.') };
          }
        } else {
          // If it's a different email, sign out current user first
          await firebaseSignOut(auth);
        }
      }

      // At this point either no user was logged in or we signed out the previous user
      // We'll try to sign in with the provided email to send verification
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, '');
        if (!userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user, {
            url: window.location.origin + '/dashboard',
            handleCodeInApp: false,
          });
          await firebaseSignOut(auth);
          return { error: null };
        } else {
          await firebaseSignOut(auth);
          return { error: new Error('This email is already verified.') };
        }
      } catch (signInError) {
        // If we can't sign in, we need the user to provide their password
        return { error: new Error('Please provide your password to resend the verification email.') };
      }
    } catch (error: any) {
      console.error('Resend verification error:', error);
      return { error: new Error('Failed to send verification email. Please try again.') };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resendVerificationEmail }}>
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