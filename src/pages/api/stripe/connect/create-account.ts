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
  if (req.method !== 'POST') {
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

    // Check if user already has a Connect account
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData?.stripeConnectAccountId) {
      // If they have an account, get the account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: userData.stripeConnectAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connect-account?error=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connect-account?success=true`,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });

      return res.status(200).json({ url: accountLink.url });
    }

    // Get user data for the account
    const userRecord = await auth.getUser(userId);
    const email = userRecord.email || undefined;
    const displayName = userRecord.displayName || undefined;

    // Create a new Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      metadata: {
        userId,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: displayName,
      },
    });

    // Store the Connect account ID in Firestore
    await db.collection('users').doc(userId).set(
      {
        stripeConnectAccountId: account.id,
        stripeConnectStatus: 'pending',
        stripeConnectCreatedAt: new Date(),
      },
      { merge: true }
    );

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connect-account?error=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connect-account?success=true`,
      type: 'account_onboarding',
      collect: 'eventually_due',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Error creating Connect account:', error);
    return res.status(500).json({ error: error.message || 'Error creating Connect account' });
  }
}