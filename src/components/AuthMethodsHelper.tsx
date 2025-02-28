import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export default function AuthMethodsHelper() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkAuthMethods = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/auth/check-auth-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check authentication methods');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while checking authentication methods');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Authentication Method Checker</CardTitle>
        <CardDescription>
          Check which authentication methods are available for an email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <Button onClick={checkAuthMethods} disabled={isLoading}>
              {isLoading ? 'Checking...' : 'Check'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4">
              {!result.exists ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Account Found</AlertTitle>
                  <AlertDescription>
                    No account was found with this email address.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert variant="default" className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle>Account Found</AlertTitle>
                    <AlertDescription>
                      This email is registered with the following authentication methods:
                    </AlertDescription>
                  </Alert>

                  <div className="bg-slate-50 p-4 rounded-md">
                    <h4 className="font-medium mb-2">Authentication Providers:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.authProviders && result.authProviders.length > 0 ? (
                        result.authProviders.map((provider: string) => (
                          <li key={provider}>
                            {provider === 'password' ? 'Email/Password' : 
                             provider === 'google.com' ? 'Google' : provider}
                          </li>
                        ))
                      ) : (
                        <li>No authentication providers found</li>
                      )}
                    </ul>
                  </div>

                  {result.multipleFirestoreUsers && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Multiple Accounts Detected</AlertTitle>
                      <AlertDescription>
                        This email is associated with multiple user accounts in the database.
                        This could cause authentication issues. Please contact support.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-gray-500">
          If you're having trouble signing in, this tool can help identify which authentication method to use.
        </p>
      </CardFooter>
    </Card>
  );
}