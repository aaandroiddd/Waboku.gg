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

    if (!userData?.stripeConnectAccountId) {
      return res.status(400).json({ error: 'No Stripe Connect account found' });
    }

    // Check if the account is active - be more flexible with status checking
    const isAccountActive = userData.stripeConnectStatus === 'active' || 
                           (userData.stripeConnectPayoutsEnabled === true && userData.stripeConnectChargesEnabled === true);
    
    if (!isAccountActive) {
      console.log('Account status check failed:', {
        stripeConnectStatus: userData.stripeConnectStatus,
        stripeConnectPayoutsEnabled: userData.stripeConnectPayoutsEnabled,
        stripeConnectChargesEnabled: userData.stripeConnectChargesEnabled
      });
      return res.status(400).json({ error: 'Stripe Connect account is not active' });
    }

    // Get account details and verify it's actually active
    const account = await stripe.accounts.retrieve(userData.stripeConnectAccountId);
    
    // Double-check account status with Stripe
    if (!account.payouts_enabled || !account.charges_enabled) {
      console.log('Stripe account not fully enabled:', {
        accountId: userData.stripeConnectAccountId,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted
      });
      return res.status(400).json({ 
        error: 'Stripe Connect account is not fully activated. Please complete your account setup.',
        details: {
          payouts_enabled: account.payouts_enabled,
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted
        }
      });
    }

    // Get balance information
    const balance = await stripe.balance.retrieve({
      stripeAccount: userData.stripeConnectAccountId,
    });

    // Get recent payouts (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const payouts = await stripe.payouts.list(
      {
        created: { gte: thirtyDaysAgo },
        limit: 50,
      },
      {
        stripeAccount: userData.stripeConnectAccountId,
      }
    );

    // Get pending payouts
    const pendingPayouts = await stripe.payouts.list(
      {
        status: 'pending',
        limit: 10,
      },
      {
        stripeAccount: userData.stripeConnectAccountId,
      }
    );

    // Get recent transfers (money coming into the Connect account)
    const transfers = await stripe.transfers.list(
      {
        destination: userData.stripeConnectAccountId,
        created: { gte: thirtyDaysAgo },
        limit: 50,
      }
    );

    // Calculate total earnings (sum of all transfers)
    const totalEarnings = transfers.data.reduce((sum, transfer) => sum + transfer.amount, 0);

    // Calculate total payouts
    const totalPayouts = payouts.data.reduce((sum, payout) => sum + payout.amount, 0);

    // Get payout schedule
    const payoutSchedule = account.settings?.payouts;

    return res.status(200).json({
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      payouts: payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        arrival_date: payout.arrival_date,
        created: payout.created,
        description: payout.description,
        failure_code: payout.failure_code,
        failure_message: payout.failure_message,
        method: payout.method,
        type: payout.type,
      })),
      pendingPayouts: pendingPayouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        arrival_date: payout.arrival_date,
        created: payout.created,
        description: payout.description,
      })),
      transfers: transfers.data.map(transfer => ({
        id: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        created: transfer.created,
        description: transfer.description,
        metadata: transfer.metadata,
      })),
      summary: {
        totalEarnings,
        totalPayouts,
        availableBalance: balance.available.reduce((sum, bal) => sum + bal.amount, 0),
        pendingBalance: balance.pending.reduce((sum, bal) => sum + bal.amount, 0),
      },
      payoutSchedule: {
        delay_days: payoutSchedule?.delay_days || 'standard',
        interval: payoutSchedule?.interval || 'daily',
        monthly_anchor: payoutSchedule?.monthly_anchor,
        weekly_anchor: payoutSchedule?.weekly_anchor,
      },
      accountDetails: {
        country: account.country,
        default_currency: account.default_currency,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
      },
    });
  } catch (error: any) {
    console.error('Error fetching payout data:', error);
    return res.status(500).json({ 
      error: error.message || 'Error fetching payout data',
      code: error.code || 'unknown_error'
    });
  }
}