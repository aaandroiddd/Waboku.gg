import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertTriangle, User, Mail, Database } from 'lucide-react';

interface MigrationResult {
  success: boolean;
  newUserId?: string;
  migratedData?: {
    profile: boolean;
    listings: number;
    orders: number;
    messages: number;
    reviews: number;
    offers: number;
    favorites: number;
    wantedPosts: number;
  };
  errors?: string[];
}

export default function UserMigrationTool() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const handleMigration = async () => {
    if (!currentUserId.trim() || !newEmail.trim() || !adminKey.trim()) {
      alert('Please fill in all fields');
      return;
    }

    if (!confirm(`Are you sure you want to migrate user ${currentUserId} to email ${newEmail}? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/migrate-user-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUserId,
          newEmail,
          adminKey,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Migration error:', error);
      setResult({
        success: false,
        errors: ['Failed to connect to migration service']
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentUserId('');
    setNewEmail('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Account Migration Tool
          </CardTitle>
          <CardDescription>
            Migrate a Google user's account data to a new email address. This creates a new account 
            and transfers all user data including listings, orders, messages, and reviews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentUserId">Current User ID</Label>
              <Input
                id="currentUserId"
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                placeholder="Enter current user ID"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="adminKey">Admin Key</Label>
            <Input
              id="adminKey"
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleMigration} 
              disabled={isLoading || !currentUserId || !newEmail || !adminKey}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {isLoading ? 'Migrating...' : 'Start Migration'}
            </Button>
            <Button 
              variant="outline" 
              onClick={resetForm}
              disabled={isLoading}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Migration Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Migration completed successfully! New user ID: <code className="bg-muted px-1 rounded">{result.newUserId}</code>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Migration failed or completed with errors. Please review the details below.
                </AlertDescription>
              </Alert>
            )}

            {result.migratedData && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Migrated Data Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Profile</span>
                    <Badge variant={result.migratedData.profile ? "default" : "destructive"}>
                      {result.migratedData.profile ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Listings</span>
                    <Badge variant="secondary">{result.migratedData.listings}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Orders</span>
                    <Badge variant="secondary">{result.migratedData.orders}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Messages</span>
                    <Badge variant="secondary">{result.migratedData.messages}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Reviews</span>
                    <Badge variant="secondary">{result.migratedData.reviews}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Offers</span>
                    <Badge variant="secondary">{result.migratedData.offers}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Favorites</span>
                    <Badge variant="secondary">{result.migratedData.favorites}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Wanted Posts</span>
                    <Badge variant="secondary">{result.migratedData.wantedPosts}</Badge>
                  </div>
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Errors Encountered
                </h4>
                <div className="space-y-1">
                  {result.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription className="text-sm">{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {result.newUserId && (
              <div className="space-y-2">
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <strong>Next Steps:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Send the new login credentials to the user at their new email address</li>
                    <li>Verify that the user can log in with their new account</li>
                    <li>Test key functionality (creating listings, messaging, etc.)</li>
                    <li>Archive or delete the old account after confirmation</li>
                    <li>Update any external integrations (Stripe Connect, etc.)</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Migration Process Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>What this tool does:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Creates a new Firebase Auth account with the specified email</li>
              <li>Transfers all user profile data and settings</li>
              <li>Updates ownership of all listings, orders, and transactions</li>
              <li>Migrates message threads and conversation history</li>
              <li>Transfers reviews, offers, favorites, and wanted posts</li>
              <li>Creates a migration log for audit purposes</li>
            </ul>
            <p className="mt-4"><strong>Important Notes:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>This process is irreversible once completed</li>
              <li>The old account should be manually archived after verification</li>
              <li>Stripe Connect accounts may need manual re-linking</li>
              <li>Users will need to log in with email/password (not Google) after migration</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}