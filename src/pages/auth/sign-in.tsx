import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import AuthError from "@/components/AuthError";

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
  const { user, signIn, signInWithGoogle } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
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

      await signIn(email, password);
      // If sign in is successful, the router.replace in the useEffect will handle redirection
    } catch (err: any) {
      console.error("Sign in error:", {
        code: err.code || err.name,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
      <Button
        variant="ghost"
        className="absolute top-4 left-4"
        onClick={() => router.back()}
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
      <Link href="/" className="mb-8">
        <Logo className="h-auto text-3xl" alwaysShowFull={true} />
      </Link>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
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