import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function PasswordResetForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);

  const checkGoogleAuth = async (email: string) => {
    try {
      const response = await fetch('/api/auth/check-google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to check authentication methods');
      }

      const data = await response.json();
      return data.hasGoogleAuth;
    } catch (err) {
      console.error('Error checking Google auth:', err);
      return false;
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }
    
    // Check if Firebase API key is configured
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setError('Authentication service is currently unavailable. Please try again later.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setIsGoogleAccount(false);

    try {
      // First check if this email is associated with Google authentication
      const hasGoogleAuth = await checkGoogleAuth(email);
      
      if (hasGoogleAuth) {
        setIsGoogleAccount(true);
        setIsLoading(false);
        return;
      }

      // Set up the action code settings with the app URL
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/sign-in`,
        handleCodeInApp: false
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      let errorMessage = 'Failed to send password reset email';
      switch (err.code) {
        case 'auth/user-not-found':
          // For security reasons, we don't want to reveal if an email exists or not
          // So we'll show success even if the email doesn't exist
          setSuccess(true);
          return;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = `Error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-3">
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || success || isGoogleAccount}
              className="w-full"
            />
            <div className="flex justify-center">
              <Button 
                onClick={handleResetPassword} 
                disabled={isLoading || success || isGoogleAccount}
                className="w-1/2"
              >
                {isLoading ? 'Checking...' : 'Send Link'}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isGoogleAccount && (
            <Alert variant="default" className="dark:bg-blue-900/20 dark:border-blue-800 bg-yellow-600 border-primary">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <AlertTitle>Google Account Detected</AlertTitle>
              <AlertDescription>
                This email is associated with a Google account. Please sign in with Google instead of using password reset.
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default" className="bg-muted/80 border-muted dark:bg-muted/30 dark:border-muted/50">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle>Email Sent</AlertTitle>
              <AlertDescription>
                If an account exists with this email address, you will receive a password reset link shortly.
                Please check your email (including spam folder) and follow the instructions.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-gray-500">
          If you don't receive an email within a few minutes, please check your spam folder or try again.
        </p>
      </CardFooter>
    </Card>
  );
}