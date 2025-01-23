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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const actionCodeSettings = {
  url: `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/auth/verify-email`,
  handleCodeInApp: true
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { auth, db } = getFirebaseServices();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
        case 'auth/invalid-login-credentials':
        case 'auth/invalid-credential':
          errorMessage = 'No account found with this email address';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
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
        const usernameDoc = await getDoc(doc(db, 'usernames', data.username));
        if (usernameDoc.exists()) {
          throw new Error('Username is already taken. Please choose another one.');
        }

        await deleteDoc(doc(db, 'usernames', profile.username));

        await setDoc(doc(db, 'usernames', data.username), {
          uid: user.uid,
          username: data.username,
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
      // Get user profile first
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const userProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;

      // Delete username document first
      if (userProfile?.username) {
        console.log('Deleting username document:', userProfile.username);
        await deleteDoc(doc(db, 'usernames', userProfile.username));
      }

      // Delete any additional usernames that might be associated with this user
      const usernamesCollection = collection(db, 'usernames');
      const usernamesQuery = query(usernamesCollection, where('uid', '==', user.uid));
      const usernamesDocs = await getDocs(usernamesQuery);
      
      // Delete all username documents
      await Promise.all(
        usernamesDocs.docs.map(async (doc) => {
          console.log('Deleting additional username document:', doc.id);
          return deleteDoc(doc.ref);
        })
      );

      // Delete user profile
      console.log('Deleting user profile:', user.uid);
      await deleteDoc(doc(db, 'users', user.uid));

      // Delete user authentication last
      console.log('Deleting user authentication:', user.uid);
      await deleteUser(user);
      
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message);
      throw err;
    }
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error('No user logged in');
    try {
      await sendEmailVerification(user, actionCodeSettings);
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        verificationSentAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      setError(err.message);
      throw err;
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

        // Update the profile with preserved data
        await setDoc(doc(db, 'users', existingUserDoc.id), updatedProfile, { merge: true });
        setProfile(updatedProfile as UserProfile);
        return result;
      }

      // If no profile exists, create a new one
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!profileDoc.exists()) {
        // Generate a unique username for new Google users
        const baseUsername = user.email.split('@')[0];
        let finalUsername = baseUsername;
        let counter = 1;

        while (true) {
          const usernameDoc = await getDoc(doc(db, 'usernames', finalUsername));
          if (!usernameDoc.exists()) break;
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          username: finalUsername,
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

        // Create user profile
        await setDoc(doc(db, 'users', user.uid), newProfile);

        // Create username document
        await setDoc(doc(db, 'usernames', finalUsername), {
          uid: user.uid,
          username: finalUsername,
          createdAt: new Date().toISOString()
        });

        setProfile(newProfile);
      } else {
        // If profile exists but wasn't found by email query
        const existingProfile = profileDoc.data() as UserProfile;
        setProfile(existingProfile);
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