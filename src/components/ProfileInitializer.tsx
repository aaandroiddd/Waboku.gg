import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/database';
import { LoadingScreen } from '@/components/LoadingScreen';
import OnboardingWizard from '@/components/OnboardingWizard';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

/**
 * Component that initializes a basic profile for a user if one doesn't exist
 * and then shows the OnboardingWizard
 */
export default function ProfileInitializer() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // If user is not logged in, redirect to sign in
    if (!isLoading && !user) {
      router.push('/auth/sign-in');
      return;
    }

    // If user is logged in and profile is already completed, redirect to dashboard
    if (!isLoading && user && profile?.profileCompleted) {
      router.push('/dashboard');
      return;
    }
    
    // If we're not loading and have a user but no profile, create a basic profile
    if (!isLoading && user && !profile && !initialized && !isInitializing) {
      const initializeProfile = async () => {
        setIsInitializing(true);
        try {
          console.log('Creating basic profile for user:', user.uid);
          const { db } = getFirebaseServices();
          
          // Generate a safe username
          let safeUsername = user.displayName || '';
          if (!safeUsername && user.email) {
            safeUsername = user.email.split('@')[0];
          }
          
          // Ensure username is valid
          if (!safeUsername || safeUsername.length < 3) {
            safeUsername = `user_${Math.floor(Math.random() * 10000)}`;
          }
          
          // Replace any invalid characters
          safeUsername = safeUsername.replace(/[^a-zA-Z0-9_]/g, '_');
          
          // Check if username already exists
          let finalUsername = safeUsername;
          try {
            const usernameDoc = await getDoc(doc(db, 'usernames', safeUsername));
            if (usernameDoc.exists()) {
              // Generate a unique username
              finalUsername = `${safeUsername}_${Math.floor(Math.random() * 10000)}`;
            }
          } catch (usernameError) {
            console.error('Error checking username:', usernameError);
            // Continue with original username if check fails
          }
          
          // Create a basic profile with default values
          const basicProfile: UserProfile = {
            uid: user.uid,
            username: finalUsername,
            displayName: finalUsername,
            email: user.email || '',
            avatarUrl: user.photoURL || '',
            photoURL: user.photoURL || '',
            bio: '',
            location: '',
            joinDate: new Date().toISOString(),
            totalSales: 0,
            rating: null,
            contact: '',
            isEmailVerified: user.emailVerified || false,
            authProvider: user.providerData[0]?.providerId || 'unknown',
            social: {
              youtube: '',
              twitter: '',
              facebook: ''
            },
            tier: 'free',
            subscription: {
              currentPlan: 'free',
              status: 'inactive'
            },
            profileCompleted: false
          };
          
          // Create the profile document
          await setDoc(doc(db, 'users', user.uid), basicProfile);
          
          // Create username document
          await setDoc(doc(db, 'usernames', finalUsername), {
            uid: user.uid,
            username: finalUsername,
            status: 'active',
            createdAt: new Date().toISOString()
          });
          
          console.log('Basic profile created successfully with username:', finalUsername);
          
          // Mark as initialized
          setInitialized(true);
        } catch (err) {
          console.error('Error creating basic profile:', err);
          setError('Failed to initialize profile. Please try refreshing the page.');
        } finally {
          setIsInitializing(false);
        }
      };
      
      initializeProfile();
    }
  }, [user, profile, isLoading, router, initialized, isInitializing]);

  // Show loading screen while checking auth state or initializing profile
  if (isLoading || isInitializing) {
    return <LoadingScreen />;
  }

  // Show error if profile initialization failed
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-md"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // If user is logged in and we have a profile (either existing or newly created),
  // show the onboarding wizard
  if (user && (profile || initialized)) {
    return <OnboardingWizard />;
  }

  // This will show briefly during redirects
  return <LoadingScreen />;
}