import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const auth = getAuth();
    const db = getFirestore();

    // Get the user from the session
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the user's Connect account ID
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Check if the user has any listings (to determine eligibility)
    const listingsSnapshot = await db.collection('listings')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    const hasListings = !listingsSnapshot.empty;
    
    // If user has listings but metadata doesn't reflect it, update the metadata
    if (hasListings && userData && (!userData.hasActiveListings || !userData.listingCount)) {
      await db.collection('users').doc(userId).update({
        hasActiveListings: true,
        listingCount: userData.listingCount ? userData.listingCount + 1 : 1
      });
      console.log('Updated user metadata with listing information');
    }

    if (!userData?.stripeConnectAccountId) {
      return res.status(200).json({ status: 'none', hasListings });
    }

    // Get the account details from Stripe
    const account = await stripe.accounts.retrieve(userData.stripeConnectAccountId);

    // Check if the account is fully onboarded
    let status: 'none' | 'pending' | 'active' | 'error' = 'none';

    if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
      status = 'active';
      
      // Update the user's Connect account status in Firestore
      await db.collection('users').doc(userId).update({
        stripeConnectStatus: 'active',
        stripeConnectDetailsSubmitted: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectUpdatedAt: new Date(),
      });
    } else if (account.details_submitted) {
      status = 'pending';
      
      // Update the user's Connect account status in Firestore
      await db.collection('users').doc(userId).update({
        stripeConnectStatus: 'pending',
        stripeConnectDetailsSubmitted: true,
        stripeConnectChargesEnabled: account.charges_enabled,
        stripeConnectPayoutsEnabled: account.payouts_enabled,
        stripeConnectUpdatedAt: new Date(),
      });
    } else {
      status = 'pending';
      
      // Update the user's Connect account status in Firestore
      await db.collection('users').doc(userId).update({
        stripeConnectStatus: 'pending',
        stripeConnectDetailsSubmitted: false,
        stripeConnectUpdatedAt: new Date(),
      });
    }

    return res.status(200).json({
      status,
      accountId: userData.stripeConnectAccountId,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      hasListings,
    });
  } catch (error: any) {
    console.error('Error checking Connect account status:', error);
    return res.status(500).json({ error: error.message || 'Error checking Connect account status' });
  }
}