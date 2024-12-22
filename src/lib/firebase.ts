import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

const auth = getAuth(app);
// Set persistence to LOCAL to maintain the session
auth.setPersistence('LOCAL');
const db = getFirestore(app);

// Username management functions
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    return !usernameDoc.exists();
  } catch (error: any) {
    console.error('Error checking username availability:', error);
    // Rethrow with more specific error information
    if (error.code === 'permission-denied') {
      error.message = 'Unable to check username availability due to permission settings.';
    }
    throw error;
  }
};

export const reserveUsername = async (username: string, userId: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'usernames', username.toLowerCase()), {
      userId,
      username,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reserving username:', error);
    throw error;
  }
};

export const releaseUsername = async (username: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'usernames', username.toLowerCase()));
  } catch (error) {
    console.error('Error releasing username:', error);
    throw error;
  }
};

export { auth, app, db };