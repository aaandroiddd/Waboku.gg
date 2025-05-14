import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to handle onboarding redirection for new users
 * This ensures users are properly redirected to complete their profile
 * after signing up or logging in with Google
 */
export function useOnboardingRedirect() {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Skip if we're already on the complete-profile page
    if (router.pathname === '/auth/complete-profile') {
      return;
    }

    // Check if user is logged in but profile is not completed
    if (user && typeof window !== 'undefined') {
      const needsProfileCompletion = localStorage.getItem('needs_profile_completion') === 'true';
      const isProfileIncomplete = profile && !profile.profileCompleted;
      
      if (needsProfileCompletion || isProfileIncomplete) {
        console.log('Profile completion needed, redirecting to onboarding wizard');
        router.push('/auth/complete-profile');
      }
    }
  }, [user, profile, router]);

  /**
   * Mark a user as needing profile completion
   * This should be called after sign up or Google sign in for new users
   */
  const markNeedsOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('needs_profile_completion', 'true');
    }
  };

  /**
   * Clear the onboarding flag
   * This should be called after profile completion
   */
  const clearOnboardingFlag = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('needs_profile_completion');
    }
  };

  return {
    markNeedsOnboarding,
    clearOnboardingFlag
  };
}