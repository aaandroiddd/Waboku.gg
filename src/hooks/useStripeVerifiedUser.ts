import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { computeIsStripeVerified, summarizeStripeVerification, StripeSignals } from '@/lib/stripe-verification';

export interface UseStripeVerifiedUserResult {
  isVerified: boolean;
  reason: string;
  loading: boolean;
  error: string | null;
  signals: StripeSignals | null;
}

/**
 * Determine if a specific user (by userId) is Stripe-verified.
 * Uses the same centralized verification logic as useStripeVerified, but for arbitrary users.
 * Reads from the users/{userId} Firestore doc, supporting both new and legacy fields:
 * - stripeConnectAccountId, stripeConnectStatus, stripeConnectDetailsSubmitted
 * - stripeConnectChargesEnabled, stripeConnectPayoutsEnabled
 * - stripeAccountVerified (legacy), stripeAccountStatus (legacy)
 */
export function useStripeVerifiedUser(userId?: string | null): UseStripeVerifiedUserResult {
  const [signals, setSignals] = useState<StripeSignals | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!userId) {
        if (isMounted) {
          setSignals(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { db } = await getFirebaseServices();
        if (!db) {
          throw new Error('Firebase DB is not initialized');
        }

        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          const data: any = snap.data() || {};
          const s: StripeSignals = {
            stripeConnectStatus: data.stripeConnectStatus ?? null,
            stripeConnectAccountId: data.stripeConnectAccountId ?? null,
            stripeConnectDetailsSubmitted: data.stripeConnectDetailsSubmitted ?? data.detailsSubmitted ?? null,
            stripeConnectChargesEnabled: data.stripeConnectChargesEnabled ?? data.chargesEnabled ?? null,
            stripeConnectPayoutsEnabled: data.stripeConnectPayoutsEnabled ?? data.payoutsEnabled ?? null,
            stripeAccountVerified: data.stripeAccountVerified ?? data.stripeVerified ?? null,
            stripeAccountStatus: data.stripeAccountStatus ?? null,
          };
          if (isMounted) setSignals(s);
        } else {
          if (isMounted) setSignals(null);
        }
      } catch (e: any) {
        console.error('useStripeVerifiedUser: error loading user signals', e);
        if (isMounted) {
          setError(e?.message || 'Failed to load verification status');
          setSignals(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const isVerified = useMemo(() => computeIsStripeVerified(signals), [signals]);
  const reason = useMemo(() => summarizeStripeVerification(signals).reason, [signals]);

  return {
    isVerified,
    reason,
    loading,
    error,
    signals,
  };
}