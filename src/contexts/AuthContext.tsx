import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null, user: User | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Starting sign up process for:', email);
      
      // First, check if the user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        console.log('User already exists in profiles table');
        return { 
          error: new Error('This email is already registered. Please try signing in instead.'),
          user: null
        };
      }

      // Proceed with sign up
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
        
        // Handle specific error cases
        if (error.message.includes('User already registered')) {
          return { 
            error: new Error('This email is already registered. Please try signing in instead.'),
            user: null
          };
        }

        if (error.message.includes('Database error')) {
          console.error('Database error details:', error);
          return { 
            error: new Error('There was an issue creating your account. Please try again later.'),
            user: null
          };
        }
        
        return { 
          error: new Error(error.message || 'An error occurred during sign up. Please try again.'),
          user: null
        };
      }

      // Verify the response data
      if (!data?.user) {
        console.error('Sign up response missing user data:', data);
        return { 
          error: new Error('Failed to create account. Please try again.'),
          user: null
        };
      }

      console.log('Sign up successful:', data.user);
      return { error: null, user: data.user };
    } catch (error: any) {
      console.error('Unexpected error during sign up:', error);
      return { 
        error: new Error('An unexpected error occurred. Please try again later.'),
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