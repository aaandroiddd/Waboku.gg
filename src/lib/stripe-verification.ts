/**
 * Centralized Stripe verification logic
 * A user is Stripe-verified if ANY of the following are true:
 * - stripeConnectStatus === 'active'
 * - (chargesEnabled === true AND payoutsEnabled === true)
 * - stripeAccountVerified === true
 * - stripeAccountStatus === 'verified'
 *
 * Also treat users with no accountId or missing flags as not verified.
 */

export type ConnectStatus = 'none' | 'pending' | 'active' | 'error' | 'not_registered' | string;

export interface StripeSignals {
  // From Stripe Connect account/status endpoints or Firestore mirrors
  stripeConnectStatus?: ConnectStatus | null;
  stripeConnectAccountId?: string | null;
  stripeConnectDetailsSubmitted?: boolean | null;
  stripeConnectChargesEnabled?: boolean | null;
  stripeConnectPayoutsEnabled?: boolean | null;

  // Legacy/user doc mirrors
  stripeAccountVerified?: boolean | null;
  stripeAccountStatus?: string | null;
}

/**
 * Returns whether the provided signals indicate a verified Stripe Connect account.
 */
export function computeIsStripeVerified(signals: StripeSignals | null | undefined): boolean {
  if (!signals) return false;

  const {
    stripeConnectStatus,
    stripeConnectAccountId,
    stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled,
    stripeAccountVerified,
    stripeAccountStatus,
  } = signals;

  // Must have some notion of an account, otherwise not verified
  const hasAnyAccountRef = Boolean(
    stripeConnectAccountId ||
    stripeAccountVerified ||
    (stripeAccountStatus && stripeAccountStatus.length > 0) ||
    (stripeConnectStatus && stripeConnectStatus !== 'none' && stripeConnectStatus !== 'not_registered')
  );

  if (!hasAnyAccountRef) return false;

  // Primary conditions
  if (stripeConnectStatus === 'active') return true;
  if (stripeConnectChargesEnabled && stripeConnectPayoutsEnabled) return true;
  if (stripeAccountVerified === true) return true;
  if ((stripeAccountStatus || '').toLowerCase() === 'verified') return true;

  return false;
}

/**
 * Summarize why a user is or isn't verified to aid UI messaging.
 */
export function summarizeStripeVerification(signals: StripeSignals | null | undefined): {
  verified: boolean;
  reason: string;
} {
  if (!signals) {
    return { verified: false, reason: 'No account detected' };
  }

  const verified = computeIsStripeVerified(signals);

  if (verified) {
    if (signals.stripeConnectStatus === 'active') {
      return { verified: true, reason: 'Stripe Connect account is active' };
    }
    if (signals.stripeConnectChargesEnabled && signals.stripeConnectPayoutsEnabled) {
      return { verified: true, reason: 'Stripe charges and payouts are enabled' };
    }
    if (signals.stripeAccountVerified) {
      return { verified: true, reason: 'User is marked verified in profile' };
    }
    if ((signals.stripeAccountStatus || '').toLowerCase() === 'verified') {
      return { verified: true, reason: 'User status is verified' };
    }
    return { verified: true, reason: 'Meets verification requirements' };
  }

  // Not verified - provide best-effort reason
  if (!signals.stripeConnectAccountId) {
    return { verified: false, reason: 'Stripe Connect not started' };
  }
  if (signals.stripeConnectStatus && signals.stripeConnectStatus !== 'active') {
    return { verified: false, reason: `Stripe Connect status: ${signals.stripeConnectStatus}` };
  }
  if (!signals.stripeConnectChargesEnabled || !signals.stripeConnectPayoutsEnabled) {
    return { verified: false, reason: 'Charges/payouts not enabled' };
  }

  return { verified: false, reason: 'Verification requirements not met' };
}