import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

interface LinkAccountRequest {
  email: string;
  password: string;
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

    const { email, password } = req.body as LinkAccountRequest;

    // Validate input
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
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

    // Check if user already has email/password provider
    const hasEmailProvider = currentUser.providerData.some(provider => provider.providerId === 'password');
    if (hasEmailProvider) {
      return res.status(400).json({ 
        success: false, 
        message: 'Your account already has email/password authentication' 
      });
    }

    // Check if user is Google-only
    const hasGoogleProvider = currentUser.providerData.some(provider => provider.providerId === 'google.com');
    if (!hasGoogleProvider) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account linking is only available for Google users' 
      });
    }

    // Check if the new email is already in use by another account
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
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
      // Update the user's email and add email/password authentication
      await admin.auth().updateUser(authResult.uid, {
        email: email,
        password: password,
        emailVerified: false // Reset email verification status for new email
      });

      // Update email in Firestore user profile
      const updatedProfile = {
        ...userProfile,
        email: email,
        isEmailVerified: false,
        emailChangedAt: new Date().toISOString(),
        previousEmail: oldEmail,
        authMethods: ['google.com', 'password'], // Track both auth methods
        accountLinkedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await setDoc(userProfileRef, updatedProfile, { merge: true });

      // Send verification email to new address
      try {
        await admin.auth().generateEmailVerificationLink(email);
        console.log('Email verification link generated for linked email');
      } catch (verificationError) {
        console.error('Failed to generate email verification link:', verificationError);
        // Don't fail the entire operation if verification email fails
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Email/password authentication has been successfully added to your account. Please check your email for verification.',
        data: {
          newEmail: email,
          oldEmail: oldEmail,
          authMethods: ['google.com', 'password'],
          emailVerified: false
        }
      });

    } catch (updateError: any) {
      console.error('Error linking account:', updateError);
      
      // Handle specific Firebase Auth errors
      let errorMessage = 'Failed to link email/password authentication';
      
      if (updateError.code === 'auth/email-already-exists') {
        errorMessage = 'This email address is already in use by another account';
      } else if (updateError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format';
      } else if (updateError.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (updateError.code === 'auth/user-not-found') {
        errorMessage = 'User account not found';
      }

      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }

  } catch (error: any) {
    console.error('Error in link-accounts API:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again later.' 
    });
  }
}