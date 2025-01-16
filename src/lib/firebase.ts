import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  Firestore
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase only once
let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

// Initialize services
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// Set persistence
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .catch(error => console.error('Error setting auth persistence:', error));
}

export { firebaseApp as app, auth, db, storage };