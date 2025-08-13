import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerAccount } from '@/hooks/useSellerAccount';
import { getFirebaseServices } from '@/lib/firebase';
import { computeIsStripeVerified, summarizeStripeVerification, StripeSignals } from '@/lib/stripe-verification';

interface UseStripeVerifiedResult {
  isVerified: boolean;
  reason: string;
  loading: boolean;
  error: string | null;
  signals: StripeSignals | null;
}

/**
 * Centralized hook to determine if the current user is Stripe-verified
 * Combines data from:
 * - useSellerAccount (Firestore + account-status API)
 * - Firestore user document legacy flags (stripeAccountVerified / stripeAccountStatus)
 */
export function useStripeVerified(): UseStripeVerifiedResult {
  const { user } = useAuth();
  const { sellerStatus, isLoading: sellerLoading, error: sellerError } = useSellerAccount();
  const [legacyFlags, setLegacyFlags] = useState<{ stripeAccountVerified?: boolean; stripeAccountStatus?: string } | null>(null);
  const [legacyLoading, setLegacyLoading] = useState<boolean>(true);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  // Load legacy flags from Firestore user document
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) {
        if (isMounted) {
          setLegacyFlags(null);
          setLegacyLoading(false);
          setLegacyError(null);
        }
        return;
      }

      try {
        setLegacyLoading(true);
        setLegacyError(null);

        const { db } = await getFirebaseServices();
        if (!db) {
          throw new Error('Firebase DB is not initialized');
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data: any = snap.data() || {};
          if (isMounted) {
            setLegacyFlags({
              stripeAccountVerified: data.stripeAccountVerified ?? data.stripeVerified ?? false,
              stripeAccountStatus: data.stripeAccountStatus ?? null,
            });
          }
        } else {
          if (isMounted) {
            setLegacyFlags(null);
          }
        }
      } catch (e: any) {
        console.error('useStripeVerified: error loading legacy flags', e);
        if (isMounted) {
          setLegacyError(e?.message || 'Failed to load verification flags');
          setLegacyFlags(null);
        }
      } finally {
        if (isMounted) {
          setLegacyLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const signals: StripeSignals | null = useMemo(() => {
    if (!user) return null;

    // Map sellerStatus fields into StripeSignals
    const mapped: StripeSignals = {
      stripeConnectStatus: (sellerStatus?.status as any) ?? null,
      stripeConnectAccountId: sellerStatus?.accountId ?? null,
      stripeConnectDetailsSubmitted: sellerStatus?.detailsSubmitted ?? null,
      stripeConnectChargesEnabled: sellerStatus?.chargesEnabled ?? null,
      stripeConnectPayoutsEnabled: sellerStatus?.payoutsEnabled ?? null,
      stripeAccountVerified: legacyFlags?.stripeAccountVerified ?? null,
      stripeAccountStatus: legacyFlags?.stripeAccountStatus ?? null,
    };

    return mapped;
  }, [user, sellerStatus, legacyFlags]);

  const loading = sellerLoading || legacyLoading;
  const error = sellerError || legacyError;

  const isVerified = computeIsStripeVerified(signals);
  const { reason } = summarizeStripeVerification(signals);

  return {
    isVerified,
    reason,
    loading,
    error,
    signals,
  };
}