import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import ProfileInitializer from '@/components/ProfileInitializer';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  useEffect(() => {
    // Log when the complete-profile page is loaded
    console.log('Complete profile page loaded');
    
    // Check if needs_profile_completion flag is set
    if (typeof window !== 'undefined') {
      const needsCompletion = localStorage.getItem('needs_profile_completion');
      console.log('needs_profile_completion flag:', needsCompletion);
      
      // If user is logged in, check if they've already completed onboarding
      if (user && !isLoading) {
        const onboardingCompletedKey = `onboarding_completed_${user.uid}`;
        const onboardingCompleted = localStorage.getItem(onboardingCompletedKey);
        
        if (onboardingCompleted === 'true' && needsCompletion !== 'true') {
          console.log('User has already completed onboarding, redirecting to dashboard');
          router.replace('/dashboard');
        }
      }
    }
  }, [user, isLoading, router]);
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return <ProfileInitializer />;
}