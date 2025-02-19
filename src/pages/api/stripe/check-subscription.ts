import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getApps, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.info('Subscription check started:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'GET') {
    console.warn('Invalid method for subscription check:', {
      method: req.method,
      url: req.url
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const userId = idToken; // In preview, we'll use the token as userId for simplicity

    // Get subscription data from Firestore
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return res.status(200).json({ 
        isPremium: false,
        subscriptionId: null,
        status: 'none'
      });
    }

    const subscriptionStatus = userData.subscriptionStatus || 'none';
    const accountTier = userData.accountTier || 'free';
    const subscriptionId = userData.subscriptionId;
    const subscriptionEndDate = userData.subscriptionEndDate;

    if (!subscriptionData) {
      return res.status(200).json({ 
        isPremium: false,
        subscriptionId: null,
        status: 'none'
      });
    }

    // Check if subscription is canceled but still active
    const now = new Date();
    const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
    const isStillActive = endDate ? now < endDate : false;

    return res.status(200).json({ 
      isPremium: isStillActive,
      subscriptionId: subscriptionData.stripeSubscriptionId || null,
      status: subscriptionData.status || 'none',
      endDate: endDate ? endDate.toISOString() : null
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}