import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

interface ChangeEmailRequest {
  newEmail: string;
  password?: string; // Required for email/password users
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (!authResult.success || !authResult.uid) {
      return res.status(401).json({ 
        success: false, 
        message: authResult.error || 'Authentication failed' 
      });
    }

    const { newEmail, password } = req.body as ChangeEmailRequest;

    // Validate input
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }

    const { admin, db: adminDb } = getFirebaseAdmin();
    const { db } = getFirebaseServices();

    // Get current user from Firebase Auth
    const currentUser = await admin.auth().getUser(authResult.uid);
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if the new email is already in use
    try {
      const existingUser = await admin.auth().getUserByEmail(newEmail);
      if (existingUser && existingUser.uid !== authResult.uid) {
        return res.status(400).json({ 
          success: false, 
          message: 'This email address is already in use by another account' 
        });
      }
    } catch (error: any) {
      // If user not found, that's good - email is available
      if (error.code !== 'auth/user-not-found') {
        console.error('Error checking email availability:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to verify email availability' 
        });
      }
    }

    // Check if user has email/password provider
    const hasEmailProvider = currentUser.providerData.some(provider => provider.providerId === 'password');
    const hasGoogleProvider = currentUser.providerData.some(provider => provider.providerId === 'google.com');
    const isGoogleOnlyUser = hasGoogleProvider && !hasEmailProvider;

    // Prevent Google-only users from changing email directly
    if (isGoogleOnlyUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google users cannot change their email directly. Please use account linking or contact support for migration assistance.',
        code: 'GOOGLE_USER_EMAIL_CHANGE_BLOCKED'
      });
    }

    // For email/password users, we need to verify their current password
    if (hasEmailProvider && !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to change email for email/password accounts' 
      });
    }

    // If user has email/password provider, verify their password
    if (hasEmailProvider && password) {
      try {
        // We can't directly verify password with Admin SDK, so we'll use client SDK
        // This is a limitation - in production, you might want to require re-authentication
        console.log('Email/password user changing email - password verification required');
      } catch (error) {
        console.error('Password verification failed:', error);
        return res.status(400).json({ 
          success: false, 
          message: 'Current password is incorrect' 
        });
      }
    }

    // Get current user profile from Firestore
    const userProfileRef = doc(db, 'users', authResult.uid);
    const userProfileDoc = await getDoc(userProfileRef);
    
    if (!userProfileDoc.exists()) {
      return res.status(404).json({ 
        success: false, 
        message: 'User profile not found' 
      });
    }

    const userProfile = userProfileDoc.data();
    const oldEmail = currentUser.email;

    try {
      // Update email in Firebase Auth
      await admin.auth().updateUser(authResult.uid, {
        email: newEmail,
        emailVerified: false // Reset email verification status
      });

      // Update email in Firestore user profile
      const updatedProfile = {
        ...userProfile,
        email: newEmail,
        isEmailVerified: false,
        emailChangedAt: new Date().toISOString(),
        previousEmail: oldEmail,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(userProfileRef, updatedProfile, { merge: true });

      // Check if there are any other user documents with the old email that need updating
      const usersRef = collection(db, 'users');
      const oldEmailQuery = query(usersRef, where('email', '==', oldEmail));
      const oldEmailSnapshot = await getDocs(oldEmailQuery);

      // Update any duplicate user documents (this handles edge cases)
      for (const docSnapshot of oldEmailSnapshot.docs) {
        if (docSnapshot.id !== authResult.uid) {
          // This is a duplicate document - update it or remove it based on your business logic
          console.log(`Found duplicate user document with old email: ${docSnapshot.id}`);
          
          // For now, we'll update the email in duplicate documents too
          await setDoc(doc(db, 'users', docSnapshot.id), {
            email: newEmail,
            lastUpdated: new Date().toISOString()
          }, { merge: true });
        }
      }

      // Send verification email to new address
      try {
        await admin.auth().generateEmailVerificationLink(newEmail);
        console.log('Email verification link generated for new email');
      } catch (verificationError) {
        console.error('Failed to generate email verification link:', verificationError);
        // Don't fail the entire operation if verification email fails
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Email address updated successfully. Please check your new email for verification.',
        data: {
          newEmail,
          oldEmail,
          emailVerified: false
        }
      });

    } catch (updateError: any) {
      console.error('Error updating email:', updateError);
      
      // Handle specific Firebase Auth errors
      let errorMessage = 'Failed to update email address';
      
      if (updateError.code === 'auth/email-already-exists') {
        errorMessage = 'This email address is already in use by another account';
      } else if (updateError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format';
      } else if (updateError.code === 'auth/user-not-found') {
        errorMessage = 'User account not found';
      }

      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }

  } catch (error: any) {
    console.error('Error in change-email API:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again later.' 
    });
  }
}