import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser,
  User,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // First check if username is available
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
        social: {
          youtube: '',
          twitter: '',
          facebook: ''
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
          // Clean up in reverse order
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
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      throw err;
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

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    if (!profile) throw new Error('No profile found');

    try {
      // If username is being updated
      if (data.username && data.username !== profile.username) {
        // Check if new username is available
        const usernameDoc = await getDoc(doc(db, 'usernames', data.username));
        if (usernameDoc.exists()) {
          throw new Error('Username is already taken. Please choose another one.');
        }

        // Delete old username document
        await deleteDoc(doc(db, 'usernames', profile.username));

        // Create new username document
        await setDoc(doc(db, 'usernames', data.username), {
          uid: user.uid,
          username: data.username,
          createdAt: new Date().toISOString()
        });

        // Update auth display name
        await firebaseUpdateProfile(user, {
          displayName: data.username
        });
      }

      const updatedProfile = {
        ...profile,
        ...data,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setProfile(updatedProfile as UserProfile);
    } catch (err: any) {
      // If username update fails, revert changes
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
    if (!user || !profile) throw new Error('No user logged in');

    try {
      // Delete user's profile document
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Delete username from usernames collection
      await deleteDoc(doc(db, 'usernames', profile.username));
      
      // Delete the user's auth account
      await deleteUser(user);
      
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    deleteAccount
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