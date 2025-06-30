import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { handlePostLoginAction, isSignOutInProgress } from '@/lib/auth-redirect-utils';
import { useFavorites } from '@/hooks/useFavorites';

interface AuthRedirectState {
  path: string | null;
  action: string | null;
  params: Record<string, any> | null;
}

interface AuthRedirectContextType {
  saveRedirectState: (action: string, params?: Record<string, any>) => void;
  getRedirectState: () => AuthRedirectState | null;
  clearRedirectState: () => void;
  handlePostLoginRedirect: () => void;
}

const AuthRedirectContext = createContext<AuthRedirectContextType | undefined>(undefined);

export function AuthRedirectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [redirectState, setRedirectState] = useState<AuthRedirectState | null>(null);

  // Load saved redirect state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('auth_redirect_state');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setRedirectState(parsedState);
        } catch (error) {
          console.error('Failed to parse saved redirect state:', error);
          localStorage.removeItem('auth_redirect_state');
        }
      }
    }
  }, []);

  // Save redirect state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && redirectState) {
      localStorage.setItem('auth_redirect_state', JSON.stringify(redirectState));
    }
  }, [redirectState]);

  const saveRedirectState = (action: string, params: Record<string, any> = {}) => {
    const state: AuthRedirectState = {
      path: router.asPath,
      action,
      params
    };
    setRedirectState(state);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect_state', JSON.stringify(state));
    }
  };

  const getRedirectState = () => {
    if (redirectState) return redirectState;
    
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('auth_redirect_state');
      if (savedState) {
        try {
          return JSON.parse(savedState);
        } catch (error) {
          console.error('Failed to parse saved redirect state:', error);
          return null;
        }
      }
    }
    return null;
  };

  const clearRedirectState = () => {
    setRedirectState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_redirect_state');
    }
  };

  const handlePostLoginRedirect = async () => {
    // Don't perform redirects if sign-out is in progress
    if (isSignOutInProgress()) {
      console.log('Sign-out in progress, skipping post-login redirect');
      return;
    }
    
    const state = getRedirectState();
    console.log('handlePostLoginRedirect called', { hasState: !!state, hasUser: !!user, state });
    
    // Debug logging
    try {
      await fetch('/api/debug/test-save-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'handlePostLoginRedirect_called',
          data: {
            hasState: !!state,
            hasUser: !!user,
            state,
            currentPath: router.asPath
          }
        })
      });
    } catch (debugError) {
      console.error('Debug logging failed:', debugError);
    }
    
    if (state && user) {
      console.log('Handling post-login redirect:', state);
      
      // First try to handle any specific actions
      if (state.action && state.params) {
        console.log('Attempting to handle action:', state.action, state.params);
        
        // Debug logging
        try {
          await fetch('/api/debug/test-save-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              step: 'handling_post_login_action',
              data: {
                action: state.action,
                params: state.params
              }
            })
          });
        } catch (debugError) {
          console.error('Debug logging failed:', debugError);
        }
        
        const actionHandled = await handlePostLoginAction(
          state.action, 
          state.params, 
          user,
          router // Pass the router instance for better navigation
        );
        
        console.log('Action handled result:', actionHandled);
        
        // If the action was handled successfully, clear the redirect state
        if (actionHandled) {
          clearRedirectState();
          return;
        }
      }
      
      // If no action or action handling failed, just redirect to the saved path
      clearRedirectState();
      if (state.path) {
        router.push(state.path);
      }
    }
  };

  // Auto-trigger redirect when user logs in
  useEffect(() => {
    if (user && !isSignOutInProgress()) {
      // Check if there's a redirect state that needs handling
      const state = getRedirectState();
      if (state) {
        console.log('User logged in with redirect state:', state);
        
        // For Google authentication, we need a longer delay to ensure
        // the authentication state is fully settled
        const delay = state.action === 'make_offer' || state.action === 'send_message' ? 300 : 100;
        
        const timer = setTimeout(() => {
          handlePostLoginRedirect();
        }, delay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Additional effect to handle Google sign-in redirects specifically
  useEffect(() => {
    if (user && !isSignOutInProgress()) {
      // Check if this is a Google sign-in that just completed
      const checkGoogleSignInRedirect = () => {
        const state = getRedirectState();
        if (state) {
          console.log('Google sign-in detected with redirect state:', state);
          // Trigger the redirect handling with a longer delay for Google users
          // to ensure the authentication state is fully settled
          setTimeout(() => {
            handlePostLoginRedirect();
          }, 500);
        }
      };

      // Check after a delay to allow Google auth to fully complete
      const timer = setTimeout(checkGoogleSignInRedirect, 400);
      
      return () => clearTimeout(timer);
    }
  }, [user, handlePostLoginRedirect, getRedirectState]);

  return (
    <AuthRedirectContext.Provider value={{ 
      saveRedirectState, 
      getRedirectState, 
      clearRedirectState,
      handlePostLoginRedirect
    }}>
      {children}
    </AuthRedirectContext.Provider>
  );
}

export function useAuthRedirect() {
  const context = useContext(AuthRedirectContext);
  if (context === undefined) {
    throw new Error('useAuthRedirect must be used within an AuthRedirectProvider');
  }
  return context;
}