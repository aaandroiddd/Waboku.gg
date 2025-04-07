import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function UserProfileSyncPage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');
  const [chatUpdateStatus, setChatUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [chatUpdateMessage, setChatUpdateMessage] = useState('');

  const handleMigrateUserProfiles = async () => {
    if (!adminSecret) {
      setMigrationStatus('error');
      setMigrationMessage('Admin secret is required');
      return;
    }

    setMigrationStatus('loading');
    setMigrationMessage('Migrating user profiles...');

    try {
      const response = await fetch('/api/admin/migrate-user-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminSecret }),
      });

      const data = await response.json();

      if (response.ok) {
        setMigrationStatus('success');
        setMigrationMessage(data.message || 'User profiles migrated successfully');
      } else {
        setMigrationStatus('error');
        setMigrationMessage(data.error || 'Failed to migrate user profiles');
      }
    } catch (error) {
      setMigrationStatus('error');
      setMigrationMessage('An error occurred while migrating user profiles');
      console.error('Error migrating user profiles:', error);
    }
  };

  const handleUpdateChatUsernames = async () => {
    if (!adminSecret) {
      setChatUpdateStatus('error');
      setChatUpdateMessage('Admin secret is required');
      return;
    }

    setChatUpdateStatus('loading');
    setChatUpdateMessage('Updating chat participant names...');

    try {
      const response = await fetch('/api/admin/update-chat-usernames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminSecret }),
      });

      const data = await response.json();

      if (response.ok) {
        setChatUpdateStatus('success');
        setChatUpdateMessage(data.message || 'Chat participant names updated successfully');
      } else {
        setChatUpdateStatus('error');
        setChatUpdateMessage(data.error || 'Failed to update chat participant names');
      }
    } catch (error) {
      setChatUpdateStatus('error');
      setChatUpdateMessage('An error occurred while updating chat participant names');
      console.error('Error updating chat participant names:', error);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">User Profile Sync Management</h1>
      
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Authentication</CardTitle>
            <CardDescription>
              Enter your admin secret to perform user profile sync operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              placeholder="Admin Secret"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Migrate User Profiles</CardTitle>
            <CardDescription>
              Copy all user display names from Firestore to Realtime Database for faster access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This operation will copy all user profile data from Firestore to the Realtime Database.
              This is useful for ensuring that user display names are quickly accessible throughout the application.
            </p>
            
            {migrationStatus === 'success' && (
              <Alert className="mb-4 bg-green-500/10 border-green-500 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{migrationMessage}</AlertDescription>
              </Alert>
            )}
            
            {migrationStatus === 'error' && (
              <Alert className="mb-4 bg-destructive/10 border-destructive text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{migrationMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleMigrateUserProfiles} 
              disabled={migrationStatus === 'loading' || !adminSecret}
            >
              {migrationStatus === 'loading' ? 'Migrating...' : 'Migrate User Profiles'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Chat Participant Names</CardTitle>
            <CardDescription>
              Add participant display names to chat data for faster rendering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This operation will update all chat entries with participant display names.
              This improves chat rendering performance by eliminating the need to look up user names separately.
            </p>
            
            {chatUpdateStatus === 'success' && (
              <Alert className="mb-4 bg-green-500/10 border-green-500 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{chatUpdateMessage}</AlertDescription>
              </Alert>
            )}
            
            {chatUpdateStatus === 'error' && (
              <Alert className="mb-4 bg-destructive/10 border-destructive text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{chatUpdateMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleUpdateChatUsernames} 
              disabled={chatUpdateStatus === 'loading' || !adminSecret}
            >
              {chatUpdateStatus === 'loading' ? 'Updating...' : 'Update Chat Usernames'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Separator className="my-8" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How User Profile Sync Works</CardTitle>
          <CardDescription>
            Understanding the user profile synchronization system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">1. User Profile Storage</h3>
              <p className="text-sm text-muted-foreground">
                User profiles are stored in Firestore as the primary source of truth, but basic profile 
                information (display name and avatar URL) is synchronized to the Realtime Database for 
                faster access.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium">2. Automatic Synchronization</h3>
              <p className="text-sm text-muted-foreground">
                When a user updates their profile, the changes are automatically synchronized to the 
                Realtime Database, ensuring that the latest display name is always available for quick access.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium">3. Chat Optimization</h3>
              <p className="text-sm text-muted-foreground">
                Chat data is enhanced with participant display names, eliminating the need for separate 
                database lookups when rendering chat messages, which improves performance.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium">4. Fallback Mechanism</h3>
              <p className="text-sm text-muted-foreground">
                If a user's display name is not found in the Realtime Database, the system will fall back 
                to checking Firestore, ensuring that display names are always available even if synchronization 
                fails.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}