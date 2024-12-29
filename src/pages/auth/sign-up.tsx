import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from '@/components/Logo';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft } from 'lucide-react';

function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-[400px] space-y-4">
        <Skeleton className="h-12 w-32 mx-auto" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function SignUpComponent() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });

  const validatePassword = (password: string) => {
    const minLength = password.length >= 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumber,
      errors: {
        minLength: !minLength,
        hasUpperCase: !hasUpperCase,
        hasLowerCase: !hasLowerCase,
        hasNumber: !hasNumber,
      }
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address.');
      }

      // Password validation
      const { isValid, errors } = validatePassword(formData.password);
      if (!isValid) {
        const errorMessages = [];
        if (errors.minLength) errorMessages.push("at least 6 characters");
        if (errors.hasUpperCase) errorMessages.push("one uppercase letter");
        if (errors.hasLowerCase) errorMessages.push("one lowercase letter");
        if (errors.hasNumber) errorMessages.push("one number");
        throw new Error(`Password must contain ${errorMessages.join(", ")}.`);
      }

      // Password confirmation check
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      await signUp(formData.email, formData.password, formData.username);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Sign up error:', {
        errorCode: err.code || 'unknown',
        errorName: err.name,
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      });
      
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email' || err.message.includes('valid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/network-request-failed' || !navigator.onLine) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
      <Button
        variant="ghost"
        className="absolute top-4 left-4"
        onClick={handleBack}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      <Link href="/" className="mb-8">
        <Logo className="h-auto text-3xl" alwaysShowFull={true} />
      </Link>

      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Join Waboku.gg to start trading cards
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                placeholder="Choose a username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                disabled={isLoading}
                minLength={6}
                autoComplete="new-password"
              />
              <PasswordStrengthIndicator password={formData.password} />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                disabled={isLoading}
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating Account...
                </div>
              ) : (
                "Create Account"
              )}
            </Button>
            
            <div className="text-sm text-center">
              <p>
                Already have an account?{' '}
                <Link href="/auth/sign-in" className="text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingState />;
  }

  return <SignUpComponent />;
}