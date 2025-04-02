import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';

// Rate limiting to prevent abuse
const limiter = rateLimit({
  limit: 5,
  window: 60 * 1000 // 60 seconds
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Apply rate limiting - 5 requests per minute per IP
    await limiter(req, res);
  } catch (error) {
    return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
  }

  try {
    // Validate Firebase configuration
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error('Firebase admin configuration is incomplete');
      return res.status(500).json({ 
        error: 'Authentication service configuration error',
        message: 'Authentication service is currently unavailable. Please try again later.'
      });
    }
    
    // Initialize Firebase Admin
    const { app } = initializeAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Get email from request body
    const { email, currentUserId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!currentUserId) {
      return res.status(400).json({ error: 'Current user ID is required' });
    }

    // Check if the email exists in Firestore
    const usersRef = db.collection('users');
    const emailQuery = usersRef.where('email', '==', email);
    const emailSnapshot = await emailQuery.get();

    // If no users found with this email, return error
    if (emailSnapshot.empty) {
      return res.status(404).json({ 
        error: 'No accounts found with this email',
        message: 'No accounts were found with this email address.'
      });
    }

    // Get all users with this email
    const users = emailSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    // Check if current user is among the users with this email
    const currentUserIndex = users.findIndex(user => user.uid === currentUserId);
    if (currentUserIndex === -1) {
      return res.status(400).json({ 
        error: 'Current user not found',
        message: 'The current user account was not found among accounts with this email.'
      });
    }

    // If only one user found, no need to link
    if (users.length === 1) {
      return res.status(200).json({ 
        message: 'No account linking needed - only one account found with this email',
        user: users[0]
      });
    }

    // Multiple users found - we need to link them
    console.log(`Found ${users.length} accounts with email ${email}`);

    // Use the current user as the primary account
    const primaryUser = users[currentUserIndex];
    const otherUsers = users.filter((_, index) => index !== currentUserIndex);

    // Determine the highest subscription tier among all accounts
    let highestTier = primaryUser.accountTier || 'free';
    let highestTierUser = primaryUser;

    for (const user of users) {
      if (user.accountTier === 'premium' && highestTier !== 'premium') {
        highestTier = 'premium';
        highestTierUser = user;
      }
    }

    // Merge profile data from all accounts
    const mergedProfile = {
      ...primaryUser,
      accountTier: highestTier,
      // Preserve the highest tier subscription data
      subscription: highestTier === 'premium' && highestTierUser.uid !== primaryUser.uid
        ? highestTierUser.subscription
        : primaryUser.subscription,
      // Use the most complete profile data
      bio: primaryUser.bio || otherUsers.find(u => u.bio)?.bio || '',
      location: primaryUser.location || otherUsers.find(u => u.location)?.location || '',
      avatarUrl: primaryUser.avatarUrl || otherUsers.find(u => u.avatarUrl)?.avatarUrl || '',
      // Merge social links
      social: {
        youtube: primaryUser.social?.youtube || otherUsers.find(u => u.social?.youtube)?.social?.youtube || '',
        twitter: primaryUser.social?.twitter || otherUsers.find(u => u.social?.twitter)?.social?.twitter || '',
        facebook: primaryUser.social?.facebook || otherUsers.find(u => u.social?.facebook)?.social?.facebook || ''
      },
      // Mark as linked account
      linkedAccounts: users.map(u => u.uid),
      lastUpdated: new Date().toISOString(),
      accountLinked: true
    };

    // Update the primary user profile with merged data
    await db.collection('users').doc(primaryUser.uid).update(mergedProfile);

    // For each other user, update their profile to point to the primary user
    for (const otherUser of otherUsers) {
      await db.collection('users').doc(otherUser.uid).update({
        primaryAccountId: primaryUser.uid,
        accountLinked: true,
        linkedTo: primaryUser.uid,
        lastUpdated: new Date().toISOString()
      });
    }

    // Return the results
    return res.status(200).json({
      success: true,
      message: 'Accounts linked successfully',
      primaryUser: {
        uid: primaryUser.uid,
        email: primaryUser.email,
        username: primaryUser.username,
        accountTier: mergedProfile.accountTier
      },
      linkedAccounts: otherUsers.map(user => ({
        uid: user.uid,
        email: user.email,
        username: user.username
      })),
      totalAccountsLinked: users.length
    });
  } catch (error: any) {
    console.error('Error linking accounts:', error);
    return res.status(500).json({
      error: 'Failed to link accounts',
      message: error.message,
      code: error.code
    });
  }
}