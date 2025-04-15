import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RecaptchaVerifier, MultiFactorResolver } from "firebase/auth";
import { createRecaptchaVerifier, startMfaVerification, handleMfaSignIn } from "@/lib/mfa-utils";

interface MfaVerificationProps {
  resolver: MultiFactorResolver;
  onComplete: () => void;
  onCancel: () => void;
}

export default function MfaVerification({ resolver, onComplete, onCancel }: MfaVerificationProps) {
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const initializeRecaptcha = () => {
    if (!recaptchaContainerRef.current) return;
    
    try {
      // Clear any existing reCAPTCHA
      recaptchaContainerRef.current.innerHTML = "";
      
      // Create new reCAPTCHA verifier with normal size and isolated mode
      recaptchaVerifierRef.current = createRecaptchaVerifier("mfa-recaptcha-container", "normal");
      
      // Render the reCAPTCHA
      recaptchaVerifierRef.current.render()
        .then((widgetId) => {
          (window as any).recaptchaWidgetId = widgetId;
          console.log("reCAPTCHA rendered successfully with widget ID:", widgetId);
        })
        .catch((error) => {
          console.error("Error rendering reCAPTCHA:", error);
          
          // Check if this is a domain verification error
          if (error.message && (
              error.message.includes("CAPTCHA_CHECK_FAILED") || 
              error.message.includes("Hostname match not found") ||
              error.message.includes("reCAPTCHA")
            )) {
            setError(
              "Domain verification failed for reCAPTCHA. This preview environment may not be registered in Firebase. " +
              "Please try again on the production domain or contact support to add this domain to your Firebase project."
            );
          } else {
            setError("Failed to initialize security verification. Please refresh the page and try again.");
          }
        });
    } catch (error: any) {
      console.error("Error initializing reCAPTCHA:", error);
      
      // Provide a more helpful error message
      if (error.message && (
          error.message.includes("CAPTCHA_CHECK_FAILED") || 
          error.message.includes("Hostname match not found") ||
          error.message.includes("reCAPTCHA")
        )) {
        setError(
          "Domain verification failed for reCAPTCHA. This preview environment may not be registered in Firebase. " +
          "Please try again on the production domain or contact support to add this domain to your Firebase project."
        );
      } else {
        setError("Failed to initialize security verification. Please refresh the page and try again.");
      }
    }
  };

  useEffect(() => {
    initializeRecaptcha();
    
    // Send verification code automatically on component mount
    sendVerificationCode();
    
    return () => {
      // Clean up reCAPTCHA when component unmounts
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (error) {
          console.error("Error clearing reCAPTCHA:", error);
        }
      }
    };
  }, []);

  const sendVerificationCode = async () => {
    setError(null);
    setSuccess(null);
    setIsSendingCode(true);
    
    try {
      if (!recaptchaVerifierRef.current) {
        throw new Error("Security verification not initialized. Please refresh the page.");
      }
      
      // Start MFA verification
      const verId = await startMfaVerification(
        resolver,
        recaptchaVerifierRef.current
      );
      
      setVerificationId(verId);
      setSuccess("Verification code sent to your phone.");
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      
      // Check for specific error types
      if (error.message && (
          error.message.includes("CAPTCHA_CHECK_FAILED") || 
          error.message.includes("Hostname match not found") ||
          error.message.includes("reCAPTCHA") ||
          error.code === "auth/captcha-check-failed"
        )) {
        setError(
          "Domain verification failed for reCAPTCHA. This preview environment may not be registered in Firebase. " +
          "Please try again on the production domain or contact support to add this domain to your Firebase project."
        );
      } else if (error.code === "auth/invalid-phone-number") {
        setError("The phone number format is incorrect. Please include your country code (e.g., +1 for US/Canada).");
      } else if (error.code === "auth/quota-exceeded") {
        setError("SMS quota exceeded. Please try again later or contact support.");
      } else if (error.code === "auth/too-many-requests") {
        setError("Too many requests. Please try again later.");
      } else {
        setError(error.message || "Failed to send verification code. Please try again.");
      }
      
      // Reset reCAPTCHA
      initializeRecaptcha();
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    if (!verificationId) {
      setError("Verification session expired. Please start over.");
      setIsLoading(false);
      return;
    }
    
    if (!verificationCode) {
      setError("Please enter the verification code.");
      setIsLoading(false);
      return;
    }
    
    try {
      // Complete MFA sign-in
      await handleMfaSignIn(
        resolver,
        verificationId,
        verificationCode
      );
      
      // Call the onComplete callback
      onComplete();
    } catch (error: any) {
      console.error("Error verifying code:", error);
      setError(error.message || "Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the verification code sent to your phone to complete sign-in.
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleVerifyCode}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          {/* Add a note about preview environments */}
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertTitle className="text-amber-800 dark:text-amber-300">Preview Environment Notice</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              Two-factor authentication may not work correctly in preview environments due to domain verification requirements. 
              If you encounter errors, please try again on the production domain.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <label htmlFor="mfa-code" className="text-sm font-medium">
              Verification Code
            </label>
            <Input
              id="mfa-code"
              type="text"
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              disabled={isLoading}
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to your phone
            </p>
          </div>
          
          <div id="mfa-recaptcha-container" ref={recaptchaContainerRef} className="flex justify-center"></div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" className="w-full" disabled={isLoading || !verificationId}>
            {isLoading ? "Verifying..." : "Verify Code"}
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full"
            onClick={sendVerificationCode}
            disabled={isSendingCode || isLoading}
          >
            {isSendingCode ? "Sending..." : "Resend Code"}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full"
            onClick={onCancel}
            disabled={isLoading || isSendingCode}
          >
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}