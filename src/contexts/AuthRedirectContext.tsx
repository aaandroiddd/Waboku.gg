import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { handlePostLoginAction } from '@/lib/auth-redirect-utils';
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
  const favorites = useFavorites();

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
    const state = getRedirectState();
    if (state && user) {
      // First try to handle any specific actions
      if (state.action && state.params) {
        const actionHandled = await handlePostLoginAction(
          state.action, 
          state.params, 
          user,
          favorites.toggleFavorite
        );
        
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