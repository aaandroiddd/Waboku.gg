import { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseServices } from './firebase';
import { getFirebaseAdmin } from './firebase-admin';
import { NextApiRequest } from 'next';

/**
 * Utility function to check if a user has multiple authentication methods
 * @param email The email address to check
 * @returns Object containing information about authentication methods
 */
export async function checkAuthMethods(email: string) {
  try {
    const { db } = getFirebaseServices();
    
    // Check if this email is associated with any user accounts
    const usersRef = collection(db, 'users');
    const emailQuery = query(usersRef, where('email', '==', email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (emailSnapshot.empty) {
      return {
        exists: false,
        hasGoogleAuth: false,
        hasEmailAuth: false,
        userIds: []
      };
    }
    
    // Collect all user IDs associated with this email
    const userIds = emailSnapshot.docs.map(doc => doc.id);
    
    // For now, we'll assume Google auth if there's a user with this email
    // In a more complete implementation, we would check the auth providers for each user
    return {
      exists: true,
      hasGoogleAuth: true, // This is an assumption - in production you'd want to check the actual auth providers
      hasEmailAuth: true,  // This is an assumption - in production you'd want to check the actual auth providers
      userIds
    };
  } catch (error) {
    console.error('Error checking auth methods:', error);
    return {
      exists: false,
      hasGoogleAuth: false,
      hasEmailAuth: false,
      userIds: [],
      error
    };
  }
}

/**
 * Utility function to get the authentication providers for a user
 * @param user The Firebase user object
 * @returns Array of provider IDs
 */
export function getUserAuthProviders(user: User | null) {
  if (!user) return [];
  
  return user.providerData.map(provider => provider.providerId);
}

/**
 * Utility function to check if a user has a specific authentication provider
 * @param user The Firebase user object
 * @param providerId The provider ID to check for
 * @returns Boolean indicating if the user has the specified provider
 */
export function hasAuthProvider(user: User | null, providerId: string) {
  if (!user) return false;
  
  return user.providerData.some(provider => provider.providerId === providerId);
}

/**
 * Utility function to check if a user has Google authentication
 * @param user The Firebase user object
 * @returns Boolean indicating if the user has Google authentication
 */
export function hasGoogleAuth(user: User | null) {
  return hasAuthProvider(user, 'google.com');
}

/**
 * Utility function to check if a user has email/password authentication
 * @param user The Firebase user object
 * @returns Boolean indicating if the user has email/password authentication
 */
export function hasEmailAuth(user: User | null) {
  return hasAuthProvider(user, 'password');
}

/**
 * Verify authentication token from API request
 * @param req The Next.js API request object
 * @returns Object with success status and user ID if successful
 */
export async function verifyAuthToken(req: NextApiRequest): Promise<{ success: boolean; uid?: string; error?: string }> {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' };
    }

    // Extract the token
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return { success: false, error: 'Missing authentication token' };
    }

    // Initialize Firebase Admin and verify the token
    const { auth } = getFirebaseAdmin();
    const decodedToken = await auth.verifyIdToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return { success: false, error: 'Invalid authentication token' };
    }

    return { success: true, uid: decodedToken.uid };
  } catch (error: any) {
    console.error('Error verifying auth token:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return { success: false, error: 'Authentication token has expired' };
    } else if (error.code === 'auth/id-token-revoked') {
      return { success: false, error: 'Authentication token has been revoked' };
    } else if (error.code === 'auth/invalid-id-token') {
      return { success: false, error: 'Invalid authentication token format' };
    } else if (error.code === 'auth/user-not-found') {
      return { success: false, error: 'User not found' };
    } else if (error.code === 'auth/user-disabled') {
      return { success: false, error: 'User account has been disabled' };
    }
    
    return { success: false, error: 'Authentication verification failed' };
  }
}