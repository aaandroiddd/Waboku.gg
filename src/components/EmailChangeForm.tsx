import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mail, Shield, Link } from 'lucide-react';

export function EmailChangeForm() {
  const { user, getIdToken } = useAuth();
  const { toast } = useToast();
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isAddingEmailAuth, setIsAddingEmailAuth] = useState(false);
  const [isCheckingAccounts, setIsCheckingAccounts] = useState(false);
  
  // Email change form state
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  
  // Add email/password auth form state
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');

  // Check if user is Google-only
  const isGoogleOnlyUser = user?.providerData?.some(provider => provider.providerId === 'google.com') &&
                          !user?.providerData?.some(provider => provider.providerId === 'password');

  const hasEmailPasswordAuth = user?.providerData?.some(provider => provider.providerId === 'password');

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newEmail.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    if (hasEmailPasswordAuth && !currentPassword) {
      toast({
        title: 'Error',
        description: 'Current password is required to change email.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingEmail(true);
    try {
      const token = await getIdToken();
      
      const response = await fetch('/api/users/change-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newEmail,
          password: currentPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        setNewEmail('');
        setCurrentPassword('');
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleAddEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkEmail || !linkEmail.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    if (!linkPassword || linkPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingEmailAuth(true);
    try {
      const token = await getIdToken();
      
      const response = await fetch('/api/auth/add-email-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: linkEmail,
          password: linkPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        setLinkEmail('');
        setLinkPassword('');
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add email/password authentication. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingEmailAuth(false);
    }
  };

  const handleCheckAccounts = async () => {
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'No user email found. Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingAccounts(true);
    try {
      const token = await getIdToken();
      
      const response = await fetch('/api/auth/link-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentUserId: user.uid
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.accountsFound && result.accountsFound.length > 0) {
          toast({
            title: 'Accounts Found',
            description: `Found ${result.accountsFound.length} other account(s) with your email address. Account linking is not yet implemented.`,
          });
        } else {
          toast({
            title: 'No Additional Accounts',
            description: 'No other accounts were found with your email address.',
          });
        }
      } else {
        toast({
          title: 'Information',
          description: result.message || 'Account check completed.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check accounts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingAccounts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Check for Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Check for Linked Accounts
          </CardTitle>
          <CardDescription>
            Check if there are other accounts associated with your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={handleCheckAccounts}
            disabled={isCheckingAccounts}
          >
            {isCheckingAccounts ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Accounts...
              </>
            ) : (
              'Check for Linked Accounts'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Add Email/Password Authentication (Google users only) */}
      {isGoogleOnlyUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Add Email/Password Authentication
            </CardTitle>
            <CardDescription>
              Add email and password authentication to your Google account for additional security.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEmailPassword} className="space-y-4">
              <div>
                <Label htmlFor="linkEmail">Email Address</Label>
                <Input
                  id="linkEmail"
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="linkPassword">Password</Label>
                <Input
                  id="linkPassword"
                  type="password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={isAddingEmailAuth}>
                {isAddingEmailAuth ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Authentication...
                  </>
                ) : (
                  'Add Email/Password Authentication'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Change Email (for users with email/password auth) */}
      {!isGoogleOnlyUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Change Email Address
            </CardTitle>
            <CardDescription>
              Update your email address. {hasEmailPasswordAuth ? 'Your current password is required.' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  required
                />
              </div>
              {hasEmailPasswordAuth && (
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                  />
                </div>
              )}
              <Button type="submit" disabled={isChangingEmail}>
                {isChangingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing Email...
                  </>
                ) : (
                  'Change Email Address'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Google-only user warning */}
      {isGoogleOnlyUser && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">
              Google Account Notice
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              You're signed in with Google. To change your email address, you can either:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Add email/password authentication above, then change your email</li>
                <li>Contact support for migration assistance</li>
              </ul>
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}