import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthRedirect } from "@/contexts/AuthRedirectContext";
import { Skeleton } from "@/components/ui/skeleton";
import AuthError from "@/components/AuthError";
import PasswordResetForm from "@/components/PasswordResetForm";
import MfaVerification from "@/components/MfaVerification";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MultiFactorResolver } from "firebase/auth";

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

function SignInComponent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const { user, signIn, signInWithGoogle } = useAuth();
  const { handlePostLoginRedirect, getRedirectState } = useAuthRedirect();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      // Check if there's a redirect state to handle
      const redirectState = getRedirectState();
      if (redirectState) {
        handlePostLoginRedirect();
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, router, handlePostLoginRedirect, getRedirectState]);

  const checkGoogleAuth = async (email: string) => {
    try {
      const response = await fetch('/api/auth/check-google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to check authentication methods');
      }

      const data = await response.json();
      return data.hasGoogleAuth;
    } catch (err) {
      console.error('Error checking Google auth:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      // Check if Firebase API key is configured
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        throw Object.assign(new Error("Authentication configuration error. Please contact support."), {
          name: "auth/configuration-error"
        });
      }
      
      if (!email || !password) {
        throw Object.assign(new Error("Please enter both email and password"), {
          name: "auth/missing-fields"
        });
      }

      if (!navigator.onLine) {
        throw Object.assign(new Error("No internet connection"), {
          name: "auth/network-request-failed"
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw Object.assign(new Error("Invalid email format"), {
          name: "auth/invalid-email"
        });
      }

      // Check if this email is associated with Google authentication
      const hasGoogleAuth = await checkGoogleAuth(email);
      
      if (hasGoogleAuth) {
        throw Object.assign(new Error("This email is associated with a Google account. Please sign in with Google instead."), {
          name: "auth/google-account"
        });
      }

      const result = await signIn(email, password);
      
      // Check if MFA is required
      if (result.mfaResolver) {
        setMfaResolver(result.mfaResolver);
      }
      // If sign in is successful, the router.replace in the useEffect will handle redirection
    } catch (err: any) {
      console.error("Sign in error:", {
        code: err.code || err.name,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      // Check if this is a multi-factor auth error
      if (err.code === 'auth/multi-factor-auth-required' || err.name === 'auth/multi-factor-auth-required') {
        try {
          // Import the necessary function from Firebase
          const { getMultiFactorResolver } = await import("firebase/auth");
          const { getFirebaseServices } = await import("@/lib/firebase");
          const { auth } = getFirebaseServices();
          
          // Get the resolver from the error
          const resolver = getMultiFactorResolver(auth, err);
          setMfaResolver(resolver);
          return; // Exit early since we're handling MFA
        } catch (mfaErr) {
          console.error("Error setting up MFA resolver:", mfaErr);
          // Fall through to the general error handling
        }
      }
      
      // Ensure we have a proper Error object with both message and name
      const error = err instanceof Error ? err : new Error(err.message || "Failed to sign in");
      error.name = err.code || err.name || "auth/unknown";
      setAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return <LoadingState />;
  }

  // If MFA verification is required, show the MFA verification component
  if (mfaResolver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => setMfaResolver(null)}
            className="flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </Button>
          <Link href="/">
            <Logo className="h-auto text-3xl" alwaysShowFull={true} />
          </Link>
          <div className="w-[72px]"></div> {/* Spacer to balance the layout */}
        </div>
        <div className="mt-24 mb-8"></div> {/* Additional spacing to push content down */}
        
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold">Two-Factor Authentication Required</h2>
          <p className="text-muted-foreground">
            A verification code is being sent to your phone automatically
          </p>
        </div>
        
        <MfaVerification 
          resolver={mfaResolver} 
          onComplete={() => {
            // MFA verification completed successfully
            // The user will be redirected by the useEffect hook that watches for user changes
          }}
          onCancel={() => {
            setMfaResolver(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </Button>
        <Link href="/">
          <Logo className="h-auto text-3xl" alwaysShowFull={true} />
        </Link>
        <div className="w-[72px]"></div> {/* Spacer to balance the layout */}
      </div>
      <div className="mt-24 mb-8"></div> {/* Additional spacing to push content down */}
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <AuthError 
              error={authError}
              onClose={() => setAuthError(null)}
            />
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In with Email"
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
                  setAuthError(null);
                  setIsGoogleLoading(true);
                  
                  try {
                    console.log('Starting Google sign-in process');
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
                    }
                  } catch (err: any) {
                    // Check if this is a multi-factor auth error
                    if (err.code === 'auth/multi-factor-auth-required' || err.name === 'auth/multi-factor-auth-required') {
                      try {
                        // Import the necessary function from Firebase
                        const { getMultiFactorResolver } = await import("firebase/auth");
                        const { getFirebaseServices } = await import("@/lib/firebase");
                        const { auth } = getFirebaseServices();
                        
                        // Get the resolver from the error
                        const resolver = getMultiFactorResolver(auth, err);
                        setMfaResolver(resolver);
                        return; // Exit early since we're handling MFA
                      } catch (mfaErr) {
                        console.error("Error setting up MFA resolver:", mfaErr);
                        // Fall through to the general error handling
                      }
                    }
                    
                    // If not an MFA error, handle normally
                    throw err;
                  }
                } catch (err: any) {
                  console.error("Google sign in error:", {
                    code: err.code || err.name,
                    message: err.message,
                    stack: err.stack,
                    timestamp: new Date().toISOString()
                  });
                  
                  const error = err instanceof Error ? err : new Error(err.message || "Failed to sign in with Google");
                  error.name = err.code || err.name || "auth/unknown";
                  setAuthError(error);
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
                  Sign in with Google
                </div>
              )}
            </Button>

            <div className="text-sm text-center">
              <p>
                Don&apos;t have an account?{" "}
                <Link href="/auth/sign-up" className="text-primary hover:underline">
                  Sign Up
                </Link>
              </p>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="auth-help">
                <AccordionTrigger className="text-sm text-muted-foreground">
                  Forgot your password?
                </AccordionTrigger>
                <AccordionContent>
                  <PasswordResetForm />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Export the component with client-side only rendering
export default function SignInPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingState />;
  }

  return <SignInComponent />;
}