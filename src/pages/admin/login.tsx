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
  const { user, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    
    try {
      // Sign in with Google
      const result = await signInWithGoogle();
      
      if (result && result.user) {
        // Check if user has moderator role by trying to access the moderation API
        const token = await result.user.getIdToken(true);
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
      console.error('Google login error:', err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsGoogleLoading(false);
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
                disabled={loading || isGoogleLoading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <LogIn className="ml-2 h-4 w-4" />}
              </Button>
            </form>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading || isGoogleLoading}
              onClick={handleGoogleLogin}
            >
              {isGoogleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </div>
              )}
            </Button>
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