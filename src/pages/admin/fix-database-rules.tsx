import { useEffect, useState } from 'react';
import { FirebaseDatabaseRulesFixer } from '@/components/FirebaseDatabaseRulesFixer';
import { UpdateDatabaseRules } from '@/components/UpdateDatabaseRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FixDatabaseRulesPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user has admin secret in localStorage
    const adminSecret = localStorage.getItem('adminSecret') || localStorage.getItem('admin_secret');
    setIsAdmin(!!adminSecret);
  }, []);

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You need admin access to use this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Please log in as an admin to access this functionality.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Database Rules Management</h1>
      
      <Tabs defaultValue="fix">
        <TabsList className="mb-4">
          <TabsTrigger value="fix">Fix Database Rules</TabsTrigger>
          <TabsTrigger value="update">Update Database Rules</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fix">
          <div className="mb-6">
            <p className="text-muted-foreground mb-4">
              If you're seeing errors like <code>String can't contain ".", "#", "$", "/", "[", or "]"</code> when updating database rules,
              use this tool to fix the issue.
            </p>
            <FirebaseDatabaseRulesFixer />
          </div>
        </TabsContent>
        
        <TabsContent value="update">
          <div className="mb-6">
            <p className="text-muted-foreground mb-4">
              Use this tool to update your database rules with the latest configuration.
            </p>
            <Card>
              <CardHeader>
                <CardTitle>Update Database Rules</CardTitle>
                <CardDescription>
                  Apply the latest database rules configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UpdateDatabaseRules />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About Database Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Firebase Realtime Database rules define who has read and write access to your database,
            how your data should be structured, and what indexes exist.
          </p>
          
          <h3 className="text-lg font-semibold mb-2">Common Issues</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Special Characters Error:</strong> Firebase doesn't allow certain special characters 
              (<code>.</code>, <code>#</code>, <code>$</code>, <code>/</code>, <code>[</code>, or <code>]</code>) 
              in keys. The <code>.info/connected</code> path needs special handling.
            </li>
            <li>
              <strong>Invalid JSON:</strong> Database rules must be valid JSON. Check for missing commas or brackets.
            </li>
            <li>
              <strong>Permission Denied:</strong> Make sure you have the correct admin credentials.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}