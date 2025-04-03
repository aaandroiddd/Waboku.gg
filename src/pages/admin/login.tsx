import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Footer } from '@/components/Footer';
import { GlobalLoading } from '@/components/GlobalLoading';

import { AlertCircle, LogIn } from 'lucide-react';

export default function ModeratorLogin() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Check if user is already logged in and is a moderator
  useEffect(() => {
    const checkModeratorStatus = async () => {
      if (user) {
        try {
          // Check if user has moderator role by trying to access the moderation API
          const token = await user.getIdToken(true);
          const response = await fetch('/api/admin/moderation/get-listings?filter=pending', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            // User is a moderator, redirect to moderation dashboard
            router.push('/admin/moderation');
            return;
          } else {
            // User is logged in but not a moderator
            setError('You do not have moderator permissions.');
          }
        } catch (err) {
          console.error('Error checking moderator status:', err);
          setError('Failed to verify moderator status.');
        }
      }
      
      setPageLoading(false);
    };
    
    checkModeratorStatus();
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // Sign in with email and password
      const userCredential = await signIn(email, password);
      
      if (userCredential && userCredential.user) {
        // Check if user has moderator role by trying to access the moderation API
        const token = await userCredential.user.getIdToken(true);
        const response = await fetch('/api/admin/moderation/get-listings?filter=pending', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          // User is a moderator, redirect to moderation dashboard
          router.push('/admin/moderation');
          return;
        } else {
          // User is not a moderator
          setError('You do not have moderator permissions.');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading animation while checking moderator status
  if (pageLoading) {
    return <GlobalLoading message="Checking authentication status..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Moderator Login</CardTitle>
            <CardDescription>
              Sign in to access the content moderation dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <LogIn className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Only users with moderator permissions can access the moderation dashboard.
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
}