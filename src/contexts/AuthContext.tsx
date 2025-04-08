import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser,
  User,
  updateProfile as firebaseUpdateProfile,
  sendEmailVerification,
  applyActionCode,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, get, update, remove } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { UserProfile } from '@/types/database';
import { 
  refreshAuthToken, 
  validateUserSession, 
  clearStoredAuthData, 
  checkAndClearStaleAuthData 
} from '@/lib/auth-token-manager';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isEmailVerified: () => boolean;
  checkVerificationStatus: () => Promise<void>;
  getIdToken: () => Promise<string>;
  checkAndLinkAccounts: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  signUp: async () => { throw new Error('AuthContext not initialized') },
  signIn: async () => { throw new Error('AuthContext not initialized') },
  signInWithGoogle: async () => { throw new Error('AuthContext not initialized') },
  signOut: async () => { throw new Error('AuthContext not initialized') },
  updateProfile: async () => { throw new Error('AuthContext not initialized') },
  deleteAccount: async () => { throw new Error('AuthContext not initialized') },
  sendVerificationEmail: async () => { throw new Error('AuthContext not initialized') },
  isEmailVerified: () => false,
  checkVerificationStatus: async () => { throw new Error('AuthContext not initialized') }
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const actionCodeSettings = {
  url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`,
  handleCodeInApp: false // Set to false for standard email verification flow
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  
  // Check if we're running on the server
  const isServer = typeof window === 'undefined';
  
  // Get Firebase services with error handling - only in browser environment
  let auth: any = null;
  let db: any = null;
  
  if (!isServer) {
    try {
      const services = getFirebaseServices();
      auth = services.auth;
      db = services.db;
    } catch (error) {
      console.error('Error getting Firebase services:', error);
      if (isMounted) {
        setError('Failed to initialize authentication services. Please refresh the page.');
        setIsLoading(false);
      }
    }
  }
  
  // Safe state update functions that check if component is still mounted
  const safeSetUser = (newUser: User | null) => {
    if (isMounted) setUser(newUser);
  };
  
  const safeSetProfile = (newProfile: UserProfile | null) => {
    if (isMounted) setProfile(newProfile);
  };
  
  const safeSetIsLoading = (loading: boolean) => {
    if (isMounted) setIsLoading(loading);
  };
  
  const safeSetError = (newError: string | null) => {
    if (isMounted) setError(newError);
  };

  useEffect(() => {
    // Check for stored auth redirect state
    const checkStoredAuthState = async () => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const storedAuth = localStorage.getItem('waboku_auth_redirect');
          if (storedAuth) {
            const authData = JSON.parse(storedAuth);
            const now = Date.now();
            const storedTime = authData.timestamp;
            
            // Only use stored auth if it's less than 30 minutes old
            if (now - storedTime < 30 * 60 * 1000) {
              console.log('Found recent auth redirect state, checking if user is still authenticated');
              
              // If we have a stored UID but no current user, try to refresh auth state
              if (authData.uid && !auth.currentUser) {
                console.log('User should be authenticated, forcing auth state refresh');
                // This will trigger the onAuthStateChanged listener
                await auth.authStateReady();
              }
            }
            
            // Clear the stored auth state regardless
            localStorage.removeItem('waboku_auth_redirect');
          }
        }
      } catch (error) {
        console.error('Error checking stored auth state:', error);
        
        // Check if this is an API key error
        if (error instanceof Error && 
            (error.message.includes('API key') || 
             error.message.includes('invalid key') || 
             error.message.includes('status: 400'))) {
          console.error('Firebase API key error detected. This may indicate an invalid or missing API key.');
          safeSetError('Authentication configuration error. Please contact support.');
        }
      }
    };
    
    checkStoredAuthState();
    
    // Enhanced function to refresh token periodically with improved error handling
    const setupTokenRefresh = (user: User) => {
      // Calculate when to refresh the token (every 20 minutes to be safe)
      // Firebase tokens expire after 60 minutes
      const refreshInterval = 20 * 60 * 1000; // 20 minutes
      
      // Store the last successful token refresh time
      const lastRefreshKey = `waboku_last_token_refresh_${user.uid}`;
      try {
        localStorage.setItem(lastRefreshKey, Date.now().toString());
      } catch (e) {
        console.warn('Could not store initial token refresh time');
      }
      
      // Set up interval to refresh token
      const intervalId = setInterval(async () => {
        try {
          // Check if we need to refresh based on last refresh time
          let lastRefreshTime = 0;
          try {
            const storedTime = localStorage.getItem(lastRefreshKey);
            if (storedTime) {
              lastRefreshTime = parseInt(storedTime, 10);
            }
          } catch (e) {
            console.warn('Could not access localStorage for token refresh timing');
          }
          
          const now = Date.now();
          // Only refresh if it's been more than 15 minutes since the last refresh
          if (now - lastRefreshTime < 15 * 60 * 1000) {
            console.log('Token was refreshed recently, skipping scheduled refresh');
            return;
          }
          
          console.log('Performing scheduled token refresh...');
          if (auth.currentUser) {
            // Import the token manager for better refresh handling
            const { refreshAuthToken } = await import('@/lib/auth-token-manager');
            const token = await refreshAuthToken(auth.currentUser);
            
            if (token) {
              console.log('Auth token refreshed successfully');
              // Update last refresh time
              try {
                localStorage.setItem(lastRefreshKey, now.toString());
              } catch (e) {
                console.warn('Could not store token refresh time');
              }
            } else {
              console.warn('Token refresh failed, will retry on next interval');
            }
          } else {
            console.warn('No current user found for token refresh');
            clearInterval(intervalId);
          }
        } catch (error) {
          console.error('Error in scheduled token refresh:', error);
        }
      }, refreshInterval);
      
      // Store the interval ID so we can clear it later
      return intervalId;
    };
    
    let tokenRefreshInterval: NodeJS.Timeout | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User ${user.uid} authenticated` : 'No user');
      
      // Clear any existing token refresh interval
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
      }
      
      safeSetUser(user);
      
      if (user) {
        // Set up token refresh for the authenticated user
        tokenRefreshInterval = setupTokenRefresh(user);
        
        try {
          // Force token refresh immediately to ensure we have a fresh token
          try {
            await user.getIdToken(true);
            console.log('Initial token refresh successful');
          } catch (tokenError) {
            console.warn('Initial token refresh failed:', tokenError);
            // Continue anyway - we'll retry in the profile fetch
          }
          
          // Attempt to fetch user profile with retries
          let profileData = null;
          let retryCount = 0;
          const maxRetries = 5; // Increased from 3 to 5
          
          while (retryCount < maxRetries) {
            try {
              console.log(`Attempting to fetch user profile (attempt ${retryCount + 1}/${maxRetries})...`);
              
              // Try to refresh token before each attempt if we've had failures
              if (retryCount > 0) {
                try {
                  await user.getIdToken(true);
                  console.log(`Refreshed token for retry attempt ${retryCount + 1}`);
                } catch (refreshError) {
                  console.warn(`Token refresh failed on retry ${retryCount + 1}:`, refreshError);
                }
              }
              
              const profileDoc = await getDoc(doc(db, 'users', user.uid));
              
              if (profileDoc.exists()) {
                profileData = profileDoc.data() as UserProfile;
                console.log('User profile found successfully');
                break; // Success, exit retry loop
              } else if (retryCount === maxRetries - 1) {
                // On last retry, create a basic profile if none exists
                console.log('No profile found after retries, creating basic profile');
                const basicProfile = {
                  uid: user.uid,
                  email: user.email!,
                  username: user.displayName || user.email!.split('@')[0],
                  joinDate: new Date().toISOString(),
                  totalSales: 0,
                  rating: 0,
                  bio: '',
                  location: '',
                  avatarUrl: user.photoURL || '',
                  isEmailVerified: user.emailVerified,
                  verificationSentAt: null,
                  social: {
                    youtube: '',
                    twitter: '',
                    facebook: ''
                  },
                  accountTier: 'free',
                  subscription: {
                    status: 'inactive',
                    currentPlan: 'free',
                    startDate: new Date().toISOString()
                  }
                };
                
                await setDoc(doc(db, 'users', user.uid), basicProfile);
                profileData = basicProfile;
                console.log('Basic profile created successfully');
              }
            } catch (fetchError) {
              console.error(`Error fetching profile (attempt ${retryCount + 1}/${maxRetries}):`, fetchError);
              
              // Exponential backoff for retries
              const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
              console.log(`Waiting ${delay}ms before next retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            retryCount++;
          }
          
          if (profileData) {
            safeSetProfile(profileData);
          } else {
            console.error('Failed to fetch or create user profile after multiple attempts');
            // Even if we failed to get the profile, we'll still consider the user authenticated
            // This prevents being stuck in a loading state
          }
        } catch (err) {
          console.error('Error in profile fetch/creation process:', err);
        }
      } else {
        safeSetProfile(null);
      }
      
      safeSetIsLoading(false);
    });

    // Set up cleanup function
    return () => {
      console.log('AuthContext unmounting, cleaning up resources');
      setIsMounted(false);
      unsubscribe();
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    let createdUser = null;
    try {
      // First check if the email is already used by a Google account
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', email));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        const existingUser = emailSnapshot.docs[0].data();
        throw new Error('This email is already registered. Please sign in with Google if you used Google to create your account.');
      }

      // Then check if username is available
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      if (usernameDoc.exists()) {
        throw new Error('Username is already taken. Please choose another one.');
      }

      // Create auth user first
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;

      // Wait for auth state to be updated
      await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsubscribe();
            resolve(user);
          }
        });
      });

      // Create the profile
      const newProfile: UserProfile = {
        uid: createdUser.uid,
        email: createdUser.email!,
        username,
        joinDate: new Date().toISOString(),
        totalSales: 0,
        rating: 0,
        bio: '',
        location: '',
        avatarUrl: '',
        isEmailVerified: false,
        verificationSentAt: null,
        social: {
          youtube: '',
          twitter: '',
          facebook: ''
        },
        accountTier: 'free',
        subscription: {
          status: 'inactive',
          currentPlan: 'free',
          startDate: new Date().toISOString()
        }
      };

      // Create user profile first
      await setDoc(doc(db, 'users', createdUser.uid), newProfile);

      // Then create username document
      await setDoc(doc(db, 'usernames', username), {
        uid: createdUser.uid,
        username: username,
        createdAt: new Date().toISOString()
      });

      // Update auth profile
      await firebaseUpdateProfile(createdUser, {
        displayName: username
      });

      setProfile(newProfile);
    } catch (err: any) {
      console.error('Sign up error:', err);
      
      // Clean up if anything fails
      if (createdUser) {
        try {
          await Promise.all([
            deleteDoc(doc(db, 'users', createdUser.uid)),
            deleteDoc(doc(db, 'usernames', username))
          ]);
          await deleteUser(createdUser);
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }
      }
      
      setError(err.message);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Ensure Firebase is initialized
      const { auth, db } = getFirebaseServices();
      
      // Validate Firebase configuration
      if (!auth) {
        throw new Error('Firebase authentication is not initialized');
      }
      
      console.log('Attempting sign in with email:', email);
      
      // First, check if this email is associated with a Google account
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', email));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        // Check if any of these users have a Google provider
        for (const userDoc of emailSnapshot.docs) {
          const userData = userDoc.data() as UserProfile;
          
          // If we find a user with this email, try to get their auth methods
          try {
            // Check if this user has a Google provider
            const provider = new GoogleAuthProvider();
            console.log('This email might be associated with a Google account. Suggesting Google sign-in.');
            throw new Error('This email appears to be registered with Google. Please try signing in with Google instead.');
          } catch (providerErr) {
            // Continue with normal sign-in if we can't determine the provider
            console.log('Continuing with normal sign-in flow');
          }
        }
      }
      
      // Proceed with normal email/password sign-in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // After successful authentication, fetch the user profile
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      if (!profileDoc.exists()) {
        console.warn('User authenticated but no profile found');
        // Create a basic profile if none exists
        const basicProfile = {
          uid: user.uid,
          email: user.email!,
          username: user.email!.split('@')[0],
          joinDate: new Date().toISOString(),
          totalSales: 0,
          rating: 0,
          bio: '',
          location: '',
          avatarUrl: '',
          isEmailVerified: user.emailVerified,
          verificationSentAt: null,
          social: {
            youtube: '',
            twitter: '',
            facebook: ''
          },
          accountTier: 'free',
          subscription: {
            status: 'inactive',
            currentPlan: 'free',
            startDate: new Date().toISOString()
          }
        };
        await setDoc(doc(db, 'users', user.uid), basicProfile);
        setProfile(basicProfile);
      } else {
        setProfile(profileDoc.data() as UserProfile);
      }
      
      return userCredential;
    } catch (err: any) {
      console.error('Sign in error:', err);
      
      let errorMessage = 'An error occurred during sign in';
      let errorCode = err.code || 'auth/unknown';
      
      switch (err.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address';
          errorCode = 'auth/user-not-found';
          break;
        case 'auth/invalid-login-credentials':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'The email or password you entered is incorrect';
          errorCode = 'auth/invalid-login-credentials';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email address but with a different sign-in method. Please try signing in with Google.';
          errorCode = 'auth/account-exists-with-different-credential';
          break;
      }
      
      const error = new Error(errorMessage);
      error.name = errorCode;
      setError(errorMessage);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // First, update signOutState collection to indicate sign-out in progress
      // This helps prevent "Missing or insufficient permissions" errors
      if (auth?.currentUser && db) {
        try {
          // Create a sign-out state document that has public read/write permissions
          await setDoc(doc(db, 'signOutState', auth.currentUser.uid), {
            signOutStarted: true,
            timestamp: new Date().toISOString()
          });
          console.log('Created signOutState document to track sign-out process');
        } catch (stateErr) {
          // Don't block sign-out if this fails
          console.warn('Could not create signOutState document:', stateErr);
        }
      }
      
      // Create local copies of user data before clearing state
      const currentUser = auth?.currentUser;
      const hasCurrentUser = !!currentUser;
      const userId = currentUser?.uid;
      
      // Clear local storage first to prevent any cached data issues
      clearStoredAuthData();
      
      // Clear state immediately to prevent React errors
      safeSetUser(null);
      safeSetProfile(null);
      
      // Check if auth is properly initialized
      if (!auth) {
        console.error('Auth is not initialized during sign out');
        return; // Return early instead of throwing - we've already cleared state
      }
      
      // Only attempt Firebase sign out if we had a user
      if (hasCurrentUser) {
        // Use a flag to track if we're still in the sign-out process
        let signOutInProgress = true;
        
        // Set a timeout to ensure we don't hang indefinitely
        setTimeout(() => {
          if (signOutInProgress) {
            console.log('Sign out taking too long, forcing completion');
            signOutInProgress = false;
          }
        }, 5000); // 5 second timeout
        
        // Attempt to sign out with retry logic
        let signOutSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!signOutSuccess && attempts < maxAttempts && signOutInProgress) {
          try {
            console.log(`Attempting to sign out from Firebase (attempt ${attempts + 1}/${maxAttempts})...`);
            
            // Use a timeout to prevent hanging
            const signOutPromise = firebaseSignOut(auth);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Sign out timeout')), 3000); // Reduced timeout
            });
            
            await Promise.race([signOutPromise, timeoutPromise]);
            signOutSuccess = true;
            signOutInProgress = false;
            console.log('Firebase sign out successful');
          } catch (signOutErr: any) {
            attempts++;
            console.error(`Sign out attempt ${attempts} failed:`, signOutErr);
            
            // If this is a network error, wait and retry
            const isNetworkError = signOutErr.code === 'auth/network-request-failed' || 
                                  signOutErr.message?.includes('network') ||
                                  signOutErr.message?.includes('timeout');
            
            if (isNetworkError && attempts < maxAttempts) {
              // Exponential backoff with jitter
              const delay = Math.min(1000 * Math.pow(2, attempts - 1), 2000) + (Math.random() * 300);
              console.log(`Waiting ${Math.round(delay)}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else if (attempts >= maxAttempts) {
              // If we've exhausted all retries, continue with cleanup anyway
              console.warn('Max sign out attempts reached, proceeding with local cleanup');
              signOutInProgress = false;
              break;
            }
          }
        }
      } else {
        console.log('No current user found during sign out, skipping Firebase sign out');
      }
      
      // Clean up the signOutState document if possible
      if (userId && db) {
        try {
          // Use a timeout to ensure this happens after the component has unmounted
          setTimeout(async () => {
            try {
              await deleteDoc(doc(db, 'signOutState', userId));
              console.log('Cleaned up signOutState document');
            } catch (cleanupErr) {
              console.warn('Could not clean up signOutState document:', cleanupErr);
            }
          }, 1000);
        } catch (e) {
          console.warn('Error setting up signOutState cleanup:', e);
        }
      }
      
      console.log('Sign out process completed');
    } catch (err: any) {
      console.error('Error in sign out process:', err);
      
      // We've already cleared state at the beginning, so no need to do it again
      // Just log the error and continue
      console.log('Sign out process completed with errors');
      
      // Don't throw the error - this prevents React errors in components
      // that called signOut and are unmounting
    }
  };

  const updateProfile = async (data: Partial<UserProfile> & { photoURL?: string }) => {
    if (!user) throw new Error('No user logged in');
    if (!profile) throw new Error('No profile found');

    try {
      if (data.username && data.username !== profile.username) {
        // Check if new username is available
        const usernameDoc = await getDoc(doc(db, 'usernames', data.username));
        if (usernameDoc.exists()) {
          throw new Error('Username is already taken. Please choose another one.');
        }

        // Delete the old username document
        await deleteDoc(doc(db, 'usernames', profile.username));

        // Create new username entry
        await setDoc(doc(db, 'usernames', data.username), {
          uid: user.uid,
          username: data.username,
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }

      // Ensure photoURL is properly set in both places
      const photoURL = data.photoURL || profile.avatarUrl || user.photoURL || '';

      // Update Firebase Auth profile
      if (data.username || photoURL) {
        await firebaseUpdateProfile(user, {
          displayName: data.username || user.displayName,
          photoURL: photoURL
        });
        
        // Reload user to ensure we have the latest data
        await user.reload();
        
        // Update local user state with the latest data
        if (auth.currentUser) {
          setUser(auth.currentUser);
        }
      }

      // Ensure consistent data between Auth and Firestore
      const updatedProfile = {
        ...profile,
        username: data.username || profile.username,
        bio: data.bio || profile.bio || '',
        avatarUrl: photoURL, // Use the same photoURL value
        displayName: data.username || profile.username, // Add displayName field for consistency
        photoURL: photoURL, // Add photoURL field for consistency
        location: data.location || profile.location || '',
        social: {
          ...profile.social,
          ...(data.social || {})
        },
        lastUpdated: new Date().toISOString()
      };

      // Update Firestore profile
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      
      // Update local profile state
      setProfile(updatedProfile as UserProfile);
      
      // Clear profile cache to ensure fresh data on next fetch
      try {
        if (typeof window !== 'undefined') {
          // Create a cache key for this user's profile
          const profileCacheKey = `profile_${user.uid}`;
          localStorage.removeItem(profileCacheKey);
          console.log('Cleared profile cache after update');
        }
      } catch (cacheError) {
        console.error('Error clearing profile cache:', cacheError);
      }
    } catch (err: any) {
      if (data.username && data.username !== profile.username) {
        try {
          await deleteDoc(doc(db, 'usernames', data.username));
          await setDoc(doc(db, 'usernames', profile.username), {
            uid: user.uid,
            username: profile.username,
            createdAt: profile.joinDate
          });
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }
      }
      setError(err.message);
      throw err;
    }
  };

  const deleteAccount = async () => {
    if (!user) throw new Error('No user logged in');

    try {
      // For Google Sign-In users, we need to reauthenticate first
      if (user.providerData[0]?.providerId === 'google.com') {
        const provider = new GoogleAuthProvider();
        try {
          // Add select_account to force account selection
          provider.setCustomParameters({
            prompt: 'select_account'
          });
          console.log('Attempting to reauthenticate Google user before account deletion');
          
          // Store current user info before reauthentication
          const currentUserEmail = user.email;
          const currentUserUid = user.uid;
          
          try {
            const result = await signInWithPopup(auth, provider);
            
            // Verify that the reauthentication was with the same account
            if (result.user.uid !== currentUserUid) {
              throw new Error('Please sign in with the same Google account you want to delete');
            }
            console.log('Google user successfully reauthenticated');
          } catch (popupError: any) {
            console.error('Popup authentication error:', popupError);
            
            // For premium users, we'll try to proceed with deletion even if reauthentication fails
            // This is a workaround for cases where the popup authentication doesn't complete properly
            const profileDoc = await getDoc(doc(db, 'users', currentUserUid));
            const userProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;
            
            if (userProfile?.accountTier === 'premium' || 
                userProfile?.subscription?.status === 'active' || 
                userProfile?.subscription?.status === 'trialing') {
              console.log('Premium user detected, attempting to proceed with deletion despite reauthentication failure');
              // Continue with the deletion process
            } else {
              // For non-premium users, we'll still require reauthentication
              if (popupError.code === 'auth/popup-closed-by-user') {
                throw new Error('Please complete the Google Sign-In process to delete your account');
              } else if (popupError.code === 'auth/popup-blocked') {
                throw new Error('Sign in popup was blocked. Please allow popups for this site.');
              } else if (popupError.code === 'auth/cancelled-popup-request') {
                throw new Error('The sign in process was cancelled. Please try again.');
              } else if (popupError.code === 'auth/network-request-failed') {
                throw new Error('Network error. Please check your internet connection and try again.');
              }
              throw new Error('Failed to reauthenticate. Please try signing in again.');
            }
          }
        } catch (reauthError: any) {
          console.error('Reauthentication error:', reauthError);
          throw reauthError;
        }
      }

      try {
        // Get a fresh token
        const token = await user.getIdToken(true);
        
        // Call the server-side API to handle account deletion
        const response = await fetch('/api/users/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
          console.error('Failed to delete account:', result);
          throw new Error(result.message || 'Failed to delete account data. Please try again.');
        }
        
        console.log('Account deleted successfully via API');
        setUser(null);
        setProfile(null);
      } catch (deleteError: any) {
        console.error('Error during deletion process:', deleteError);
        throw new Error(deleteError.message || 'Failed to delete account data. Please try again.');
      }
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message || 'Failed to delete account. Please try again.');
      throw err;
    }
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error('No user logged in');
    
    // Check if user is already verified
    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }
    
    // Check if we've sent a verification email recently (within last 5 minutes)
    if (profile?.verificationSentAt) {
      const lastSent = new Date(profile.verificationSentAt).getTime();
      const now = new Date().getTime();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - lastSent < fiveMinutes) {
        throw new Error('Please wait 5 minutes before requesting another verification email');
      }
    }
    
    try {
      // Ensure we have valid Firebase configuration
      const { auth, db } = getFirebaseServices();
      if (!auth || !auth.currentUser) {
        throw new Error('Firebase authentication is not properly initialized');
      }

      // Ensure we have a valid app URL
      if (!process.env.NEXT_PUBLIC_APP_URL) {
        throw new Error('Application URL is not configured');
      }

      const continueUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`;
      const verificationSettings = {
        url: continueUrl,
        handleCodeInApp: false
      };

      console.log('Sending verification email with settings:', {
        email: user.email,
        continueUrl,
        handleCodeInApp: false
      });
      
      // Reload user before sending verification email
      await user.reload();
      
      await sendEmailVerification(auth.currentUser, verificationSettings);
      
      // Update the profile with verification sent timestamp
      const updatedProfile = {
        ...profile,
        verificationSentAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setProfile(updatedProfile as UserProfile);
      
      console.log('Verification email sent successfully');
    } catch (err: any) {
      console.error('Error sending verification email:', {
        code: err.code,
        message: err.message,
        details: err.details,
        stack: err.stack
      });
      
      let errorMessage = 'Failed to send verification email';
      switch (err.code) {
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/invalid-continue-uri':
          errorMessage = 'Invalid verification URL configuration.';
          break;
        case 'auth/missing-continue-uri':
          errorMessage = 'Missing verification URL configuration.';
          break;
        case 'auth/unauthorized-continue-uri':
          errorMessage = 'The verification URL domain is not authorized.';
          break;
        default:
          errorMessage = `Verification email error: ${err.message}`;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const isEmailVerified = () => {
    return user?.emailVerified || false;
  };

  const checkVerificationStatus = async () => {
    if (!user) return;
    
    try {
      await user.reload();
      const freshUser = auth.currentUser;
      
      if (!freshUser) return;
      
      if (freshUser.emailVerified !== profile?.isEmailVerified) {
        const updatedProfile = {
          ...profile,
          isEmailVerified: freshUser.emailVerified,
          lastVerificationCheck: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', freshUser.uid), updatedProfile, { merge: true });
        setProfile(updatedProfile as UserProfile);
      }
      
      setUser(freshUser);
    } catch (err: any) {
      console.error('Error checking verification status:', err);
    }
  };

  const signUpWithVerification = async (email: string, password: string, username: string) => {
    await signUp(email, password, username);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (auth.currentUser) {
      await sendVerificationEmail();
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Validate Firebase API key before attempting sign-in
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        throw new Error('Firebase API key is missing. Please check your environment configuration.');
      }
      
      const provider = new GoogleAuthProvider();
      
      // Before signing in with popup, check if email exists
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (!user.email) {
        throw new Error('No email provided from Google account');
      }

      // Check if user profile exists with this email
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', user.email));
      const emailSnapshot = await getDocs(emailQuery);
      
      let needsProfileCompletion = false;
      
      if (!emailSnapshot.empty) {
        const existingUserDoc = emailSnapshot.docs[0];
        const existingProfile = existingUserDoc.data() as UserProfile;

        // If the profile exists, preserve the existing data
        const updatedProfile = {
          ...existingProfile,
          isEmailVerified: user.emailVerified,
          lastSignIn: new Date().toISOString(),
          // Only update these if they don't exist
          avatarUrl: existingProfile.avatarUrl || user.photoURL || '',
        };

        // Check if profile needs completion (missing username, bio, or location)
        if (!existingProfile.profileCompleted && 
            (!existingProfile.username || !existingProfile.location)) {
          needsProfileCompletion = true;
          updatedProfile.profileCompleted = false;
        }

        // Update the profile with preserved data
        await setDoc(doc(db, 'users', existingUserDoc.id), updatedProfile, { merge: true });
        setProfile(updatedProfile as UserProfile);
        
        // Store the profile completion status for redirection
        if (needsProfileCompletion) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('needs_profile_completion', 'true');
          }
        }
        
        return { ...result, needsProfileCompletion };
      }

      // If no profile exists, create a new one
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!profileDoc.exists()) {
        // Generate a temporary username for new Google users
        const baseUsername = user.email.split('@')[0];
        let tempUsername = baseUsername;
        let counter = 1;

        while (true) {
          const usernameDoc = await getDoc(doc(db, 'usernames', tempUsername));
          if (!usernameDoc.exists()) break;
          tempUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          username: tempUsername,
          joinDate: new Date().toISOString(),
          totalSales: 0,
          rating: 0,
          bio: '',
          location: '',
          avatarUrl: user.photoURL || '',
          isEmailVerified: user.emailVerified,
          verificationSentAt: null,
          profileCompleted: false, // Mark as incomplete
          social: {
            youtube: '',
            twitter: '',
            facebook: ''
          },
          accountTier: 'free',
          subscription: {
            status: 'inactive',
            currentPlan: 'free',
            startDate: new Date().toISOString()
          }
        };

        // Create user profile
        await setDoc(doc(db, 'users', user.uid), newProfile);

        // Create temporary username document
        await setDoc(doc(db, 'usernames', tempUsername), {
          uid: user.uid,
          username: tempUsername,
          createdAt: new Date().toISOString(),
          isTemporary: true // Mark as temporary
        });

        setProfile(newProfile);
        
        // Store the profile completion status for redirection
        if (typeof window !== 'undefined') {
          localStorage.setItem('needs_profile_completion', 'true');
        }
        
        return { ...result, needsProfileCompletion: true };
      } else {
        // If profile exists but wasn't found by email query
        const existingProfile = profileDoc.data() as UserProfile;
        
        // Check if profile needs completion
        if (!existingProfile.profileCompleted && 
            (!existingProfile.username || !existingProfile.location)) {
          needsProfileCompletion = true;
          
          // Update profile to mark as incomplete
          await setDoc(doc(db, 'users', user.uid), {
            ...existingProfile,
            profileCompleted: false
          }, { merge: true });
          
          existingProfile.profileCompleted = false;
          
          // Store the profile completion status for redirection
          if (typeof window !== 'undefined') {
            localStorage.setItem('needs_profile_completion', 'true');
          }
        }
        
        setProfile(existingProfile);
        return { ...result, needsProfileCompletion };
      }

      return result;
    } catch (err: any) {
      console.error('Google sign in error:', err);
      let errorMessage = 'Failed to sign in with Google';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign in cancelled';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Sign in popup was blocked. Please allow popups for this site.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email address. Please sign in using your original method.';
      }
      
      setError(errorMessage);
      throw err;
    }
  };

  const getIdToken = async (): Promise<string> => {
    if (!user) {
      throw new Error('No user logged in');
    }
    try {
      return await user.getIdToken(true);
    } catch (err) {
      console.error('Error getting ID token:', err);
      throw new Error('Failed to get authentication token');
    }
  };

  const checkAndLinkAccounts = async () => {
    if (!user || !user.email) {
      throw new Error('No authenticated user with email');
    }

    try {
      // Get a fresh token
      const token = await user.getIdToken(true);
      
      // Call the API to check for accounts with the same email
      const response = await fetch('/api/auth/link-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
          currentUserId: user.uid
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Failed to link accounts:', result);
        throw new Error(result.message || 'Failed to link accounts. Please try again.');
      }
      
      // If accounts were linked, refresh the profile
      if (result.success && result.totalAccountsLinked > 1) {
        // Reload the user profile
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          const updatedProfile = profileDoc.data() as UserProfile;
          setProfile(updatedProfile);
          
          // Show success message
          console.log('Accounts linked successfully:', result);
          return {
            success: true,
            message: 'Your accounts have been linked successfully.',
            linkedAccounts: result.totalAccountsLinked
          };
        }
      }
      
      return result;
    } catch (err: any) {
      console.error('Error linking accounts:', err);
      setError(err.message || 'Failed to link accounts. Please try again.');
      throw err;
    }
  };

  const value = {
    user,
    profile,
    isLoading,
    error,
    signUp: signUpWithVerification,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    deleteAccount,
    sendVerificationEmail,
    isEmailVerified,
    checkVerificationStatus,
    getIdToken,
    checkAndLinkAccounts
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}