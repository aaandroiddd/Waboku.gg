import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Mail, User, Calendar, AlertTriangle } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
  joinDate: string;
  lastUpdated: string;
  accountTier: string;
}

interface VerificationResult {
  success: boolean;
  message: string;
  updatedUser?: UserData;
}

interface EmailVerificationManagerProps {
  adminKey?: string;
}

export default function EmailVerificationManager({ adminKey }: EmailVerificationManagerProps) {
  const [userInput, setUserInput] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const lookupUser = async () => {
    if (!userInput.trim()) {
      setError('Please enter a user ID or email address');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUserData(null);

    try {
      const response = await fetch('/api/admin/lookup-user-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminKey || '',
        },
        body: JSON.stringify({ 
          identifier: userInput.trim() 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to lookup user');
      }

      setUserData(data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to lookup user');
    } finally {
      setLoading(false);
    }
  };

  const enableEmailVerification = async () => {
    if (!userData) return;

    setVerifying(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/enable-email-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminKey || '',
        },
        body: JSON.stringify({ 
          userId: userData.uid 
        }),
      });

      const data: VerificationResult = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to enable email verification');
      }

      setSuccess(data.message);
      if (data.updatedUser) {
        setUserData(data.updatedUser);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable email verification');
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Verification Manager
        </CardTitle>
        <CardDescription>
          Look up users and manually enable email verification for their accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter user ID or email address"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && lookupUser()}
            className="flex-1"
          />
          <Button 
            onClick={lookupUser} 
            disabled={loading || !userInput.trim()}
          >
            {loading ? 'Looking up...' : 'Lookup User'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {userData && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="font-mono text-sm bg-muted p-2 rounded">{userData.uid}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm bg-muted p-2 rounded">{userData.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                  <p className="text-sm bg-muted p-2 rounded">{userData.displayName || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Tier</label>
                  <Badge variant={userData.accountTier === 'premium' ? 'default' : 'secondary'}>
                    {userData.accountTier}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Verification Status</span>
                  <div className="flex items-center gap-2">
                    {userData.isEmailVerified ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Verified
                        </Badge>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <Badge variant="destructive">
                          Not Verified
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {!userData.isEmailVerified && (
                  <div className="pt-2">
                    <Button 
                      onClick={enableEmailVerification}
                      disabled={verifying}
                      className="w-full"
                    >
                      {verifying ? 'Enabling Verification...' : 'Enable Email Verification'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Join Date
                  </label>
                  <p className="text-sm bg-muted p-2 rounded">{formatDate(userData.joinDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-sm bg-muted p-2 rounded">{formatDate(userData.lastUpdated)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}