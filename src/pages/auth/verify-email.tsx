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
        console.error('Email verification error:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        
        setStatus('error');
        switch (error.code) {
          case 'auth/invalid-action-code':
            setError('The verification link has expired or has already been used. Please request a new verification email.');
            break;
          case 'auth/user-disabled':
            setError('This account has been disabled. Please contact support for assistance.');
            break;
          case 'auth/user-not-found':
            setError('The account associated with this verification link no longer exists.');
            break;
          case 'auth/api-key-service-blocked':
            setError('The verification service is temporarily unavailable. Please try again in a few minutes or contact support if the issue persists.');
            break;
          default:
            setError('Failed to verify email. Please try again or contact support if the issue persists.');
        }
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