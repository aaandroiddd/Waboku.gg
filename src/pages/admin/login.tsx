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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AlertCircle, LogIn, Key } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const { user, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const { returnUrl } = router.query;

  // Check if user is already logged in and has admin/moderator permissions
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        try {
          // Check if user has admin/moderator role using the verify endpoint
          const token = await user.getIdToken(true);
          const response = await fetch('/api/admin/verify', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            // User is authorized, redirect to return URL or default admin page
            if (returnUrl && typeof returnUrl === 'string') {
              router.push(returnUrl);
            } else {
              router.push('/admin/moderation');
            }
            return;
          } else {
            // User is logged in but not authorized
            setError('You do not have admin or moderator permissions.');
          }
        } catch (err) {
          console.error('Error checking admin status:', err);
          setError('Failed to verify admin status.');
        }
      }
      
      setPageLoading(false);
    };
    
    checkAdminStatus();
  }, [user, router, returnUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // Sign in with email and password
      const userCredential = await signIn(email, password);
      
      if (userCredential && userCredential.user) {
        // Check if user has admin/moderator role using the verify endpoint
        const token = await userCredential.user.getIdToken(true);
        const response = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          // User is authorized, redirect to return URL or default admin page
          if (returnUrl && typeof returnUrl === 'string') {
            router.push(returnUrl);
          } else {
            router.push('/admin/moderation');
          }
          return;
        } else {
          // User is not authorized
          setError('You do not have admin or moderator permissions.');
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
      // Import Firebase auth directly to get the user immediately after sign-in
      const { getFirebaseServices } = await import('@/lib/firebase');
      const { auth } = getFirebaseServices();
      
      // Sign in with Google
      await signInWithGoogle();
      
      // Wait for auth state to settle and get the current user directly from Firebase
      let attempts = 0;
      const maxAttempts = 10;
      let currentUser = null;
      
      while (attempts < maxAttempts && !currentUser) {
        await new Promise(resolve => setTimeout(resolve, 500));
        currentUser = auth.currentUser;
        attempts++;
      }
      
      if (currentUser) {
        // Check if user has admin/moderator role using the verify endpoint
        const token = await currentUser.getIdToken(true);
        const response = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          // User is authorized, redirect to return URL or default admin page
          if (returnUrl && typeof returnUrl === 'string') {
            router.push(returnUrl);
          } else {
            router.push('/admin/moderation');
          }
          return;
        } else {
          // User is not authorized
          const responseText = await response.text();
          console.error('Admin verify API response:', response.status, responseText);
          setError('You do not have admin or moderator permissions.');
        }
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAdminSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);
    setIsAdminLoading(true);
    
    try {
      // Verify admin secret
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Store admin secret in localStorage
        localStorage.setItem('adminSecret', adminSecret);
        setAdminSuccess('Admin secret verified successfully. You can now access admin pages.');
        
        // Redirect to the return URL or Firebase connection debug page
        setTimeout(() => {
          if (returnUrl && typeof returnUrl === 'string') {
            router.push(returnUrl);
          } else {
            router.push('/admin/firebase-connection-debug');
          }
        }, 1500);
      } else {
        setAdminError('Invalid admin secret. Please check and try again.');
      }
    } catch (err: any) {
      console.error('Admin secret verification error:', err);
      setAdminError(err.message || 'Failed to verify admin secret.');
    } finally {
      setIsAdminLoading(false);
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
            <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
            <CardDescription>
              Sign in to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="moderator">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="moderator">Moderator Login</TabsTrigger>
                <TabsTrigger value="admin">Admin Secret</TabsTrigger>
              </TabsList>
              
              <TabsContent value="moderator" className="mt-4">
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
              </TabsContent>
              
              <TabsContent value="admin" className="mt-4">
                {adminError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{adminError}</AlertDescription>
                  </Alert>
                )}
                
                {adminSuccess && (
                  <Alert className="mb-4 bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-800">
                    <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-600 dark:text-green-400">{adminSuccess}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleAdminSecretSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminSecret">Admin Secret</Label>
                    <Input
                      id="adminSecret"
                      type="password"
                      placeholder="Enter admin secret key"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isAdminLoading}
                  >
                    {isAdminLoading ? 'Verifying...' : 'Verify Admin Secret'}
                    {!isAdminLoading && <Key className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
                
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>Use this method to access Firebase connection debugging and other admin tools.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Only authorized users can access the admin dashboard.
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
}