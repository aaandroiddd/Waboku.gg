import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null, user: User | null }>;
  signOut: () => Promise<void>;
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

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Starting sign up process for:', email);
      
      // Check if the Supabase client is properly initialized
      if (!supabase.auth) {
        console.error('Supabase client not properly initialized');
        throw new Error('Service configuration error');
      }

      // Attempt to sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/sign-in`,
          data: {
            email: email,
          }
        }
      });
      
      if (error) {
        console.error('Supabase sign up error:', error);
        
        // Map Supabase errors to user-friendly messages
        if (error.message.includes('User already registered')) {
          throw new Error('This email is already registered. Please try signing in instead.');
        }

        if (error.message.includes('rate limit')) {
          throw new Error('Too many attempts. Please try again later.');
        }

        if (error.message.includes('valid email')) {
          throw new Error('Please enter a valid email address.');
        }

        if (error.message.includes('password')) {
          throw new Error('Password must be at least 6 characters long.');
        }

        // Generic error for other cases
        throw error;
      }

      // Check if we have a user in the response
      if (!data?.user) {
        console.error('Sign up response missing user data:', data);
        throw new Error('Unable to create account. Please try again.');
      }

      console.log('Sign up successful for user:', data.user.id);
      return { error: null, user: data.user };

    } catch (error: any) {
      console.error('Sign up process error:', error);
      return { 
        error: error instanceof Error ? error : new Error('An unexpected error occurred'),
        user: null
      };
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      return { error: null }
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Sign out error:', error);
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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