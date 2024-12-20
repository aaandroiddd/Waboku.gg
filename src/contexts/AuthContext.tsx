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
      
      // First check if the email exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        // Email exists, try to sign in to check verification status
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (!userCredential.user.emailVerified) {
            // User exists but not verified
            await sendEmailVerification(userCredential.user, {
              url: window.location.origin + '/dashboard',
              handleCodeInApp: false,
            });
            await firebaseSignOut(auth);
            return { 
              error: new Error('This email is already registered but not verified. A new verification email has been sent.'),
              user: null,
              isExisting: true
            };
          } else {
            // User exists and is verified
            await firebaseSignOut(auth);
            return {
              error: new Error('This email is already registered and verified. Please sign in instead.'),
              user: null,
              isExisting: true
            };
          }
        } catch (signInError: any) {
          // If sign in fails, it means the password is different
          return {
            error: new Error('This email is already registered. Please sign in or reset your password.'),
            user: null,
            isExisting: true
          };
        }
      }
      
      // If we get here, the email doesn't exist, so create new account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      if (userCredential.user) {
        try {
          await sendEmailVerification(userCredential.user, {
            url: window.location.origin + '/dashboard',
            handleCodeInApp: false,
          });
          console.log('Verification email sent successfully');
        } catch (verificationError) {
          console.error('Error sending verification email:', verificationError);
          // We don't want to fail the sign-up process if email verification fails
          // The user can request a new verification email from the dashboard
        }
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

      // Try to sign in temporarily to send verification email
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
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
        }
      } catch (error) {
        return { error: new Error('Unable to verify email status. Please try signing in again.') };
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