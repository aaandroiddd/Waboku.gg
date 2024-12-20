import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X } from "lucide-react";
import dynamic from 'next/dynamic'
import { useAuth } from "@/contexts/AuthContext";

const SignUpComponent = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const { user, signUp } = useAuth();

  // Password requirements state
  const [requirements, setRequirements] = useState({
    minLength: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasMixedCase: false
  });

  // Update requirements as user types
  useEffect(() => {
    setRequirements({
      minLength: password.length >= 6,
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasMixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password)
    });
  }, [password]);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    
    // Client-side validation
    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!email.includes('@')) {
      setError("Please enter a valid email address");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError, user: newUser, isExisting } = await signUp(email, password);
      
      if (signUpError) {
        console.error('Sign up error:', signUpError);
        
        // If the email is already in use, check if it's verified
        if (signUpError.message.includes('already registered')) {
          const { error: resendError } = await resendVerificationEmail(email);
          if (!resendError) {
            setError("This email is already registered but not verified. We've sent a new verification email.");
          } else {
            setError("This email is already registered. Please try signing in instead.");
          }
        } else {
          setError(signUpError.message);
        }
        
        setIsLoading(false);
        return;
      }

      if (!newUser) {
        setError("Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Account created successfully! Please check your email for verification.");
      // Redirect to verification page after a short delay
      setTimeout(() => {
        router.push("/auth/verify-email");
      }, 2000);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const RequirementIndicator = ({ met }: { met: boolean }) => (
    met ? 
      <Check className="w-4 h-4 text-green-500" /> : 
      <X className="w-4 h-4 text-red-500" />
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Link href="/" className="mb-8">
        <Logo className="w-32 h-auto" />
      </Link>
      <TooltipProvider>
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Sign up to start trading cards in your local area
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {successMessage && (
                <Alert>
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}
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
                <div className="relative">
                  <Tooltip open={showTooltip}>
                    <TooltipTrigger asChild>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setShowTooltip(true)}
                        onBlur={() => setShowTooltip(false)}
                        required
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="w-72 p-3 space-y-2 bg-card border"
                      sideOffset={5}
                    >
                      <p className="font-medium mb-2">Password Requirements:</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <RequirementIndicator met={requirements.minLength} />
                          <span className="text-sm">At least 6 characters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RequirementIndicator met={requirements.hasNumber} />
                          <span className="text-sm">Contains a number</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RequirementIndicator met={requirements.hasSpecialChar} />
                          <span className="text-sm">Contains a special character</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RequirementIndicator met={requirements.hasMixedCase} />
                          <span className="text-sm">Contains mixed case letters</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
              <p className="text-sm text-center">
                Already have an account?{" "}
                <Link href="/auth/sign-in" className="text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </TooltipProvider>
    </div>
  );
};

export default dynamic(() => Promise.resolve(SignUpComponent), {
  ssr: false
});