import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/database';
import { LoadingScreen } from '@/components/LoadingScreen';
import OnboardingWizard from '@/components/OnboardingWizard';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
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
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);

  // Set local profile when auth profile changes
  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    // If user is not logged in, redirect to sign in
    if (!isLoading && !user) {
      router.push('/auth/sign-in');
      return;
    }

    // Check if onboarding was previously completed
    if (!isLoading && user) {
      const onboardingCompletedKey = `onboarding_completed_${user.uid}`;
      const onboardingCompleted = localStorage.getItem(onboardingCompletedKey);
      
      if (onboardingCompleted === 'true') {
        console.log('Onboarding was previously completed, redirecting to dashboard');
        router.push('/dashboard');
        return;
      }
    }

    // If user is logged in and profile is already completed, redirect to dashboard
    if (!isLoading && user && profile?.profileCompleted) {
      console.log('Profile is already completed, redirecting to dashboard');
      // Mark onboarding as completed in localStorage
      if (typeof window !== 'undefined' && user) {
        localStorage.setItem(`onboarding_completed_${user.uid}`, 'true');
      }
      router.push('/dashboard');
      return;
    }
    
    // If we're not loading and have a user but no profile or profile data, create a basic profile
    if (!isLoading && user && !initialized && !isInitializing && !profileData) {
      const initializeProfile = async () => {
        setIsInitializing(true);
        try {
          console.log('Checking/creating profile for user:', user.uid);
          const { db } = getFirebaseServices();
          
          // First check if a profile already exists
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (profileDoc.exists()) {
            // Profile exists, but may need to be marked as incomplete
            const existingProfile = profileDoc.data() as UserProfile;
            
            // If profile exists but is incomplete, update it
            if (!existingProfile.profileCompleted) {
              console.log('Profile exists but is incomplete, updating it');
              setProfileData(existingProfile);
              setInitialized(true);
              setIsInitializing(false);
              return;
            }
            
            // If profile is complete, redirect to dashboard
            if (existingProfile.profileCompleted) {
              console.log('Profile is complete, redirecting to dashboard');
              router.push('/dashboard');
              return;
            }
          }
          
          // No profile exists, create a new one
          console.log('No profile found, creating a basic profile');
          
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
          
          // Check if username already exists - first check usernames collection
          let finalUsername = safeUsername;
          let isUnique = false;
          let counter = 1;
          
          while (!isUnique) {
            try {
              // Check in usernames collection
              const usernameDoc = await getDoc(doc(db, 'usernames', finalUsername));
              
              if (!usernameDoc.exists()) {
                // Also check in users collection by username field
                const usersRef = collection(db, 'users');
                const usernameQuery = query(
                  usersRef, 
                  where('username', '==', finalUsername),
                  limit(1)
                );
                
                const usernameSnapshot = await getDocs(usernameQuery);
                
                if (usernameSnapshot.empty) {
                  isUnique = true;
                } else {
                  finalUsername = `${safeUsername}_${counter}`;
                  counter++;
                }
              } else {
                finalUsername = `${safeUsername}_${counter}`;
                counter++;
              }
            } catch (usernameError) {
              console.error('Error checking username:', usernameError);
              // Generate a unique username with timestamp to ensure uniqueness
              finalUsername = `${safeUsername}_${Date.now().toString().slice(-6)}`;
              isUnique = true;
            }
          }
          
          // Determine auth provider
          const authProvider = user.providerData[0]?.providerId || 'unknown';
          const isGoogleUser = authProvider === 'google.com';
          
          console.log('User auth provider:', authProvider, 'isGoogleUser:', isGoogleUser);
          
          // For Google users, use their display name if available
          let displayName = user.displayName || finalUsername;
          
          // For Google users, log additional information for debugging
          if (isGoogleUser) {
            console.log('Google user detected during profile initialization');
            console.log('Google display name:', user.displayName);
            console.log('Google photo URL:', user.photoURL);
            console.log('Generated username:', finalUsername);
          }
          
          // Create a basic profile with default values
          const currentDate = new Date().toISOString();
          const basicProfile: UserProfile = {
            uid: user.uid,
            username: finalUsername,
            displayName: displayName,
            email: user.email || '',
            avatarUrl: user.photoURL || '',
            photoURL: user.photoURL || '',
            bio: '',
            location: '',
            joinDate: currentDate,
            totalSales: 0,
            rating: null,
            contact: '',
            isEmailVerified: user.emailVerified || false,
            authProvider: authProvider,
            social: {
              youtube: '',
              twitter: '',
              facebook: ''
            },
            accountTier: 'free',
            tier: 'free',
            subscription: {
              currentPlan: 'free',
              status: 'inactive',
              startDate: currentDate
            },
            profileCompleted: false,
            lastUpdated: currentDate
          };
          
          // Create the profile document
          await setDoc(doc(db, 'users', user.uid), basicProfile);
          
          // Create username document
          await setDoc(doc(db, 'usernames', finalUsername), {
            uid: user.uid,
            username: finalUsername,
            status: 'active',
            createdAt: new Date().toISOString(),
            isTemporary: true // Mark as temporary until user confirms in onboarding
          });
          
          console.log('Basic profile created successfully with username:', finalUsername);
          
          // Store the profile data
          setProfileData(basicProfile);
          
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
  if (user && (localProfile || profileData || initialized)) {
    // Use profileData if available, otherwise fall back to localProfile
    const profileToUse = profileData || localProfile;
    
    console.log('Rendering OnboardingWizard with profile:', profileToUse);
    
    return <OnboardingWizard initialProfile={profileToUse} />;
  }

  // This will show briefly during redirects
  return <LoadingScreen />;
}