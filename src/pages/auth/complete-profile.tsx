import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingWizard from '@/components/OnboardingWizard';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function CompleteProfilePage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is not logged in, redirect to sign in
    if (!isLoading && !user) {
      router.push('/auth/sign-in');
      return;
    }

    // If user is logged in and profile is already completed, redirect to dashboard
    if (!isLoading && user && profile?.profileCompleted) {
      router.push('/dashboard');
    }
  }, [user, profile, isLoading, router]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If user is logged in but profile is not completed, show the onboarding wizard
  if (user && !profile?.profileCompleted) {
    return <OnboardingWizard />;
  }

  // This will show briefly during redirects
  return <LoadingScreen />;
}