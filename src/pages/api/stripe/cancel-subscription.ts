import { NextApiRequest, NextApiResponse } from 'next';
import { getApps, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import { ref, get } from 'firebase/database';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId, userId } = req.body;

    // Detailed request logging
    console.log('Cancellation request received:', {
      subscriptionId,
      userId
    });

    // Validate required fields
    if (!subscriptionId) {
      console.error('Missing subscription ID');
      return res.status(400).json({ 
        error: 'Subscription ID is required',
        code: 'MISSING_SUBSCRIPTION_ID'
      });
    }

    if (!userId) {
      console.error('Missing user ID');
      return res.status(400).json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    // Use admin database instance for server operations
    const db = getAdminDatabase();
    const userRef = ref(db, `users/${userId}/account/subscription`);
    
    try {
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      if (!userData) {
        console.error('No subscription data found in Firebase:', { userId });
        return res.status(404).json({
          error: 'No subscription data found',
          code: 'NO_SUBSCRIPTION_DATA'
        });
      }

      if (userData.status === 'canceled') {
        console.log('Subscription already canceled:', { userId, subscriptionData: userData });
        return res.status(400).json({
          error: 'Subscription is already canceled',
          code: 'ALREADY_CANCELED'
        });
      }
    } catch (dbError) {
      console.error('Error accessing Firebase:', dbError);
      return res.status(500).json({
        error: 'Database error occurred',
        code: 'DATABASE_ERROR'
      });
    }

    // Get current subscription data
    const subscriptionSnapshot = await db.ref(`users/${userId}/account/subscription`).get();
    const currentSubscription = subscriptionSnapshot.val();

    if (!currentSubscription || !currentSubscription.startDate) {
      return res.status(400).json({
        error: 'Invalid subscription data',
        code: 'INVALID_SUBSCRIPTION_DATA'
      });
    }

    // Calculate the end date based on the original start date
    const startDate = new Date(currentSubscription.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Add one month from the start date

    // Update subscription status in Firebase
    await db.ref(`users/${userId}/account`).update({
      subscription: {
        ...currentSubscription,
        status: 'canceled',
        endDate: endDate.toISOString(),
        stripeSubscriptionId: subscriptionId,
        canceledAt: new Date().toISOString()
      }
    });

    console.log('Cancellation successful:', {
      userId,
      endDate: endDate.toISOString()
    });

    return res.status(200).json({ 
      success: true,
      message: 'Subscription canceled successfully',
      endDate: endDate.toISOString()
    });

  } catch (error: any) {
    console.error('Subscription cancellation error:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message || 'Unknown error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}