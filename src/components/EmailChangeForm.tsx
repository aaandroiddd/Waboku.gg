import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Shield, AlertTriangle } from 'lucide-react';

interface EmailChangeFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function EmailChangeForm({ onSuccess, onError }: EmailChangeFormProps) {
  const { user, getIdToken } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check user's authentication providers
  const isEmailPasswordUser = user?.providerData?.some(provider => provider.providerId === 'password') || false;
  const isGoogleUser = user?.providerData?.some(provider => provider.providerId === 'google.com') || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmDialog(true);
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

          {/* Information for Google Users */}
          {isGoogleUser && !isEmailPasswordUser && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Since you signed in with Google, you won't need to enter a password. 
                Your Google account email will be updated.
              </AlertDescription>
            </Alert>
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