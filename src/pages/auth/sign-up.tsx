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
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import AuthError from '@/components/AuthError';

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
  const { signUp, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);

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

      // Terms of Use agreement check
      if (!agreeToTerms) {
        throw new Error('You must agree to the Terms of Use to create an account.');
      }

      await signUp(formData.email, formData.password, formData.username);
      
      // Mark user as needing profile completion
      if (typeof window !== 'undefined') {
        localStorage.setItem('needs_profile_completion', 'true');
      }
      
      // Force a full page reload redirect to the complete-profile page
      window.location.replace('/auth/complete-profile');
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
      
      const error = err instanceof Error ? err : new Error(errorMessage);
      error.name = err.code || err.name || "auth/unknown";
      setError(error);
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
      
      <Link href="/" className="mb-8 mt-12">
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
            <AuthError 
              error={error}
              onClose={() => setError(null)}
            />
            
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

            <div className="flex items-start space-x-2 pt-2">
              <Checkbox
                id="agree-terms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <label
                htmlFor="agree-terms"
                className="text-sm leading-5 cursor-pointer"
              >
                I agree to the{' '}
                <Link 
                  href="/terms-of-use" 
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Terms of Use
                </Link>
                {' '}and{' '}
                <Link 
                  href="/privacy-policy" 
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating Account...
                </div>
              ) : (
                "Create Account with Email"
              )}
            </Button>

            <div className="relative">
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
              disabled={isLoading || isGoogleLoading}
              onClick={async () => {
                try {
                  setError(null);
                  
                  // Terms of Use agreement check for Google sign-up
                  if (!agreeToTerms) {
                    throw new Error('You must agree to the Terms of Use to create an account.');
                  }
                  
                  setIsGoogleLoading(true);
                  console.log('Starting Google sign-up process');
                  const result = await signInWithGoogle();
                  
                  // Check if profile completion is needed
                  if (result && result.needsProfileCompletion) {
                    console.log('Profile completion needed, redirecting to onboarding wizard');
                    
                    // Log whether this is a new user or existing user
                    if (result.isNewUser) {
                      console.log('This is a new Google user (sign-up)');
                    } else {
                      console.log('This is a returning Google user with incomplete profile');
                    }
                    
                    // Force a full page reload redirect to the complete-profile page
                    window.location.href = '/auth/complete-profile';
                    return;
                  } else {
                    console.log('No profile completion needed, continuing to dashboard');
                    router.push('/dashboard');
                  }
                } catch (err: any) {
                  const error = err instanceof Error ? err : new Error(err.message || "Failed to sign in with Google");
                  error.name = err.code || err.name || "auth/unknown";
                  setError(error);
                } finally {
                  setIsGoogleLoading(false);
                }
              }}
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
                  Continue with Google
                </div>
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