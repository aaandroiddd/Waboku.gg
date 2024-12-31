import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function VerificationStatus() {
  const { user, profile, sendVerificationEmail, isEmailVerified, checkVerificationStatus } = useAuth();
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [canResend, setCanResend] = useState(true);

  useEffect(() => {
    if (user && !isEmailVerified()) {
      const interval = setInterval(() => {
        checkVerificationStatus();
      }, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [user, checkVerificationStatus]);

  useEffect(() => {
    if (profile?.verificationSentAt) {
      setLastSent(new Date(profile.verificationSentAt));
    }
  }, [profile?.verificationSentAt]);

  useEffect(() => {
    if (lastSent) {
      const timer = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - lastSent.getTime();
        setCanResend(diff >= 60000); // Can resend after 1 minute
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lastSent]);

  if (!user || isEmailVerified()) return null;

  const [showSuccess, setShowSuccess] = useState(false);

  const handleResend = async () => {
    if (!canResend) return;
    try {
      await sendVerificationEmail();
      setLastSent(new Date());
      setCanResend(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000); // Hide success message after 3 seconds
    } catch (error) {
      console.error('Error sending verification email:', error);
    }
  };

  return (
    <Alert className="mb-4">
      <AlertTitle>Email Verification Required</AlertTitle>
      <AlertDescription className="mt-2">
        <p>Please verify your email address to become a verified seller. Check your inbox for a verification link.</p>
        <div className="mt-2">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={!canResend}
          >
            {canResend ? 'Resend Verification Email' : 'Wait 1 minute before resending'}
          </Button>
          {showSuccess && (
            <p className="text-green-600 mt-2">
              Verification email sent! Please check your inbox.
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}