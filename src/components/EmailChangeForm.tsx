import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Shield, AlertTriangle, Link, UserPlus, ArrowRight } from 'lucide-react';

interface EmailChangeFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function EmailChangeForm({ onSuccess, onError }: EmailChangeFormProps) {
  const { user, getIdToken } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [confirmLinkPassword, setConfirmLinkPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check user's authentication providers
  const isEmailPasswordUser = user?.providerData?.some(provider => provider.providerId === 'password') || false;
  const isGoogleUser = user?.providerData?.some(provider => provider.providerId === 'google.com') || false;
  const isGoogleOnlyUser = isGoogleUser && !isEmailPasswordUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmDialog(true);
  };

  const handleAccountLinking = async () => {
    if (!user || !newEmail || !linkPassword) return;

    if (linkPassword !== confirmLinkPassword) {
      setError('Passwords do not match');
      return;
    }

    if (linkPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await getIdToken();

      const response = await fetch('/api/auth/link-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail.toLowerCase().trim(),
          password: linkPassword
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to link email/password authentication');
      }

      setSuccess('Email/password authentication has been added to your account! You can now change your email address.');
      setNewEmail('');
      setLinkPassword('');
      setConfirmLinkPassword('');
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => setSuccess(''), 5000);

    } catch (err: any) {
      console.error('Error linking account:', err);
      const errorMessage = err.message || 'Failed to link account. Please try again.';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }

      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmEmailChange = async () => {
    if (!user || !newEmail) return;

    setIsLoading(true);
    setError('');
    setSuccess('');
    setShowConfirmDialog(false);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if new email is the same as current
      if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
        throw new Error('New email must be different from your current email');
      }

      // For email/password users, password is required
      if (isEmailPasswordUser && !password) {
        throw new Error('Password is required to change your email address');
      }

      // Get authentication token
      const token = await getIdToken();

      // Call API to change email
      const response = await fetch('/api/users/change-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newEmail: newEmail.toLowerCase().trim(),
          ...(isEmailPasswordUser && { password })
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to change email address');
      }

      setSuccess(result.message || 'Email address updated successfully!');
      setNewEmail('');
      setPassword('');
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);

    } catch (err: any) {
      console.error('Error changing email:', err);
      const errorMessage = err.message || 'Failed to change email address. Please try again.';
      setError(errorMessage);
      
      // Call error callback
      if (onError) {
        onError(errorMessage);
      }

      // Clear error message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  // For Google-only users, show special interface
  if (isGoogleOnlyUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Management for Google Users
          </CardTitle>
          <CardDescription>
            Choose how you'd like to manage your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-700 border-green-200 mb-4">
              <Mail className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Current Email Display */}
          <div className="space-y-2 mb-6">
            <Label>Current Email (Google Account)</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user.email}</span>
              <div className="flex items-center gap-1 text-blue-600">
                <Shield className="h-3 w-3" />
                <span className="text-xs">Google</span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="explanation" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="explanation">Why This Matters</TabsTrigger>
              <TabsTrigger value="link-account">Add Email/Password</TabsTrigger>
              <TabsTrigger value="migration">Account Migration</TabsTrigger>
            </TabsList>

            <TabsContent value="explanation" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> You signed in with Google, which means your email address is managed by Google, not by our platform.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Why can't I change my email directly?</h4>
                  <p className="text-sm text-muted-foreground">
                    When you sign in with Google, your email address is tied to your Google account. 
                    Changing it in our system would prevent you from logging in with Google next time, 
                    potentially locking you out of your account and losing all your data.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">What are my options?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>Change your Google email:</strong> Update your email in your Google account settings</li>
                    <li>• <strong>Add email/password login:</strong> Link a new email with password to your account</li>
                    <li>• <strong>Migrate to a new account:</strong> We can help you move your data to a new account</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="link-account" className="space-y-4">
              <Alert>
                <Link className="h-4 w-4" />
                <AlertDescription>
                  Add email/password authentication to your account. This will allow you to sign in with either Google or email/password, and change your email in the future.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="linkEmail">New Email Address</Label>
                  <Input
                    id="linkEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter your new email address"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkPassword">Create Password</Label>
                  <Input
                    id="linkPassword"
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Create a password (min. 6 characters)"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmLinkPassword">Confirm Password</Label>
                  <Input
                    id="confirmLinkPassword"
                    type="password"
                    value={confirmLinkPassword}
                    onChange={(e) => setConfirmLinkPassword(e.target.value)}
                    placeholder="Confirm your password"
                    disabled={isLoading}
                  />
                </div>

                <Button 
                  onClick={handleAccountLinking}
                  disabled={isLoading || !newEmail || !linkPassword || !confirmLinkPassword}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Linking Account...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      Add Email/Password Authentication
                    </div>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="migration" className="space-y-4">
              <Alert>
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  We can help you create a new account with your desired email and transfer your data. This process requires manual assistance from our support team.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">What gets transferred?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• All your active and archived listings</li>
                    <li>• Your reviews and ratings</li>
                    <li>• Order history and transaction records</li>
                    <li>• Account settings and preferences</li>
                    <li>• Premium subscription status</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                  <h4 className="font-semibold mb-2 text-orange-800">Important Notes</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• This process takes 1-2 business days</li>
                    <li>• You'll need to create the new account first</li>
                    <li>• Message history cannot be transferred</li>
                    <li>• Your old account will be deactivated</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => window.open('/support', '_blank')}
                  variant="outline"
                  className="w-full"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Contact Support for Account Migration
                  </div>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // For email/password users or users with both auth methods
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Change Email Address
        </CardTitle>
        <CardDescription>
          Update the email address associated with your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-700 border-green-200">
              <Mail className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Current Email Display */}
          <div className="space-y-2">
            <Label>Current Email</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user.email}</span>
              {user.emailVerified ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Shield className="h-3 w-3" />
                  <span className="text-xs">Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">Unverified</span>
                </div>
              )}
            </div>
          </div>

          {/* New Email Input */}
          <div className="space-y-2">
            <Label htmlFor="newEmail">New Email Address</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter your new email address"
              required
              disabled={isLoading}
            />
          </div>

          {/* Password Input for Email/Password Users */}
          {isEmailPasswordUser && (
            <div className="space-y-2">
              <Label htmlFor="password">Current Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Your current password is required to verify your identity
              </p>
            </div>
          )}

          {/* Warning about email verification */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> After changing your email, you'll need to verify 
              your new email address. You may need to sign in again after the change.
            </AlertDescription>
          </Alert>

          {/* Submit Button with Confirmation Dialog */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                type="submit" 
                disabled={isLoading || !newEmail || (isEmailPasswordUser && !password)}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Changing Email...
                  </div>
                ) : (
                  'Change Email Address'
                )}
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Email Change</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>Are you sure you want to change your email address?</p>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p><strong>From:</strong> {user.email}</p>
                    <p><strong>To:</strong> {newEmail}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You'll need to verify your new email address and may need to sign in again.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmEmailChange}
                  disabled={isLoading}
                >
                  {isLoading ? 'Changing...' : 'Confirm Change'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </CardContent>
    </Card>
  );
}