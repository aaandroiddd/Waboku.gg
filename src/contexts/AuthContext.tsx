import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser,
  User
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
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
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

      // Save user profile
      await setDoc(doc(db, 'users', user.uid), newProfile);
      
      // Reserve username
      await setDoc(doc(db, 'usernames', username), {
        uid: user.uid,
        createdAt: new Date().toISOString()
      });
      
      setProfile(newProfile);
    } catch (err: any) {
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

    try {
      const updatedProfile = {
        ...profile,
        ...data,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setProfile(updatedProfile as UserProfile);
    } catch (err: any) {
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