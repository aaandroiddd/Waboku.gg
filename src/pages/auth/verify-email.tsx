import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyEmail() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      const { oobCode } = router.query;

      if (typeof oobCode !== 'string') {
        setStatus('error');
        setError('Invalid verification code');
        return;
      }

      try {
        await applyActionCode(auth, oobCode);
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setError(error.message || 'Failed to verify email');
      }
    };

    if (router.isReady) {
      verifyEmail();
    }
  }, [router.isReady, router.query]);

  return (
    <div className="container mx-auto max-w-md py-12">
      <Card className="p-6">
        <div className="text-center">
          {status === 'loading' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Verifying your email...</h2>
              <p>Please wait while we verify your email address.</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-green-600">Email Verified!</h2>
              <p className="mb-6">Your email has been successfully verified.</p>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-red-600">Verification Failed</h2>
              <p className="mb-4 text-red-500">{error}</p>
              <p className="mb-6">
                The verification link may have expired or already been used. 
                Please try requesting a new verification email from your dashboard.
              </p>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}