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
  
  const { auth, db } = getFirebaseServices();

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
      }
    };
    
    checkStoredAuthState();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User ${user.uid} authenticated` : 'No user');
      setUser(user);
      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
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
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
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

      if (data.username || data.photoURL) {
        await firebaseUpdateProfile(user, {
          displayName: data.username || user.displayName,
          photoURL: data.photoURL || user.photoURL
        });
      }

      const updatedProfile = {
        ...profile,
        username: data.username || profile.username,
        bio: data.bio || profile.bio || '',
        avatarUrl: data.photoURL || profile.avatarUrl || '',
        location: data.location || profile.location || '',
        social: {
          ...profile.social,
          ...(data.social || {})
        },
        lastUpdated: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile as UserProfile);
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
          const result = await signInWithPopup(auth, provider);
          
          // Verify that the reauthentication was with the same account
          if (result.user.uid !== user.uid) {
            throw new Error('Please sign in with the same Google account you want to delete');
          }
        } catch (reauthError: any) {
          console.error('Reauthentication error:', reauthError);
          if (reauthError.code === 'auth/popup-closed-by-user') {
            throw new Error('Please complete the Google Sign-In process to delete your account');
          } else if (reauthError.code === 'auth/popup-blocked') {
            throw new Error('Sign in popup was blocked. Please allow popups for this site.');
          } else if (reauthError.code === 'auth/cancelled-popup-request') {
            throw new Error('The sign in process was cancelled. Please try again.');
          } else if (reauthError.code === 'auth/network-request-failed') {
            throw new Error('Network error. Please check your internet connection and try again.');
          }
          throw new Error('Failed to reauthenticate. Please try signing in again.');
        }
      }

      try {
        // Get user profile first
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        const userProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;

        // Find and delete ALL username documents (both active and archived) associated with this user
        const usernamesCollection = collection(db, 'usernames');
        const usernamesQuery = query(usernamesCollection, where('uid', '==', user.uid));
        const usernamesDocs = await getDocs(usernamesQuery);
        
        // Delete all username documents in parallel
        const deletePromises = usernamesDocs.docs.map(async (doc) => {
          console.log('Deleting username document:', doc.id, 'Status:', doc.data().status || 'active');
          return deleteDoc(doc.ref);
        });

        // Wait for all username deletions to complete
        await Promise.all(deletePromises);

        // If we have the current username from profile and it wasn't found in the query
        if (userProfile?.username) {
          const currentUsernameDoc = doc(db, 'usernames', userProfile.username);
          const currentUsernameSnapshot = await getDoc(currentUsernameDoc);
          if (currentUsernameSnapshot.exists()) {
            console.log('Deleting current username document:', userProfile.username);
            await deleteDoc(currentUsernameDoc);
          }
        }

        // Delete user's favorites
        console.log('Deleting user favorites:', user.uid);
        const favoritesRef = collection(db, 'users', user.uid, 'favorites');
        const favoritesSnapshot = await getDocs(favoritesRef);
        const favoritesDeletePromises = favoritesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(favoritesDeletePromises);

        // Delete user's messages from Realtime Database
        console.log('Deleting user messages:', user.uid);
        const { firebaseDb, realtimeDb } = getFirebaseServices();
        
        // Get all chats where user is a participant
        const chatsRef = ref(realtimeDb, 'chats');
        const chatsSnapshot = await get(chatsRef);
        const chatsData = chatsSnapshot.val();
        
        if (chatsData) {
          const userChatIds = Object.entries(chatsData)
            .filter(([_, chat]: [string, any]) => chat.participants && chat.participants[user.uid])
            .map(([chatId]) => chatId);
          
          // For each chat, either delete it completely or mark as deleted by this user
          for (const chatId of userChatIds) {
            const chatRef = ref(realtimeDb, `chats/${chatId}`);
            const chatData = chatsData[chatId];
            
            // If only two participants and one is the current user, delete the entire chat
            const participants = Object.keys(chatData.participants || {});
            if (participants.length <= 2) {
              // Delete the entire chat and its messages
              await remove(ref(realtimeDb, `chats/${chatId}`));
              await remove(ref(realtimeDb, `messages/${chatId}`));
            } else {
              // Mark as deleted for current user and remove from participants
              const updates: Record<string, any> = {
                [`chats/${chatId}/deletedBy/${user.uid}`]: true
              };
              delete updates[`chats/${chatId}/participants/${user.uid}`];
              await update(ref(realtimeDb), updates);
            }
          }
        }

        // Delete user's order history
        console.log('Deleting user order history:', user.uid);
        // Delete orders where user is buyer
        const buyerOrdersRef = collection(db, 'orders');
        const buyerOrdersQuery = query(buyerOrdersRef, where('buyerId', '==', user.uid));
        const buyerOrdersSnapshot = await getDocs(buyerOrdersQuery);
        const buyerOrdersDeletePromises = buyerOrdersSnapshot.docs.map(doc => deleteDoc(doc.ref));
        
        // Delete orders where user is seller
        const sellerOrdersRef = collection(db, 'orders');
        const sellerOrdersQuery = query(sellerOrdersRef, where('sellerId', '==', user.uid));
        const sellerOrdersSnapshot = await getDocs(sellerOrdersQuery);
        const sellerOrdersDeletePromises = sellerOrdersSnapshot.docs.map(doc => deleteDoc(doc.ref));
        
        // Wait for all order deletions to complete
        await Promise.all([...buyerOrdersDeletePromises, ...sellerOrdersDeletePromises]);

        // Delete user profile
        console.log('Deleting user profile:', user.uid);
        await deleteDoc(doc(db, 'users', user.uid));

        // Delete user authentication last
        console.log('Deleting user authentication:', user.uid);
        await deleteUser(user);
        
        setUser(null);
        setProfile(null);
      } catch (deleteError: any) {
        console.error('Error during deletion process:', deleteError);
        throw new Error('Failed to delete account data. Please try again.');
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
    checkVerificationStatus
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