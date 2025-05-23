import { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getApp } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
try {
  getApp();
} catch {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const storageRules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Function to check if the file is an image
    function isImageType() {
      return request.resource.contentType.matches('image/.*');
    }

    // Function to check file size (5MB max)
    function isValidSize() {
      return request.resource.size < 5 * 1024 * 1024;
    }

    // Function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    match /avatars/{userId}/{fileName} {
      // Allow read access to anyone for avatars
      allow read: if true;
      
      // Allow users to upload their own avatar with strict validation
      allow create, update: if isAuthenticated()
                           && userId == request.auth.uid
                           && isValidSize()
                           && isImageType()
                           && fileName.matches('profile\\\\.(jpg|jpeg|png|webp)$');

      // Allow users to delete their own avatar
      allow delete: if isAuthenticated()
                   && userId == request.auth.uid;
    }

    match /listings/{userId}/{fileName} {
      // Allow read access to anyone for listing images
      allow read: if true;
      
      // Allow write access only to authenticated users with validation
      allow create: if isAuthenticated()
                   && userId == request.auth.uid
                   && isValidSize()
                   && isImageType()
                   && fileName.matches('^[\\\\w\\\\-\\\\.]+\\\\.(jpg|jpeg|png|webp)$');

      // Allow update and delete only to the owner
      allow update, delete: if isAuthenticated()
                          && userId == request.auth.uid;
    }

    // Default rule - deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get storage instance
    const storage = admin.storage();
    const bucket = storage.bucket();

    // Update storage rules
    await bucket.setMetadata({
      metadata: {
        firebaseStorageRule: storageRules
      }
    });

    return res.status(200).json({ message: 'Storage rules updated successfully' });
  } catch (error) {
    console.error('Error updating storage rules:', error);
    return res.status(500).json({ error: 'Failed to update storage rules' });
  }
}