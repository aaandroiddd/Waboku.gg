import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    
    // Send verification code automatically on component mount without requiring CAPTCHA
    sendVerificationCodeAutomatically();
    
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

  // Function to automatically send verification code without requiring CAPTCHA
  const sendVerificationCodeAutomatically = async () => {
    setError(null);
    setSuccess(null);
    setIsSendingCode(true);
    
    try {
      // Create a temporary invisible recaptcha container if needed
      if (!document.getElementById('invisible-recaptcha-container')) {
        const container = document.createElement('div');
        container.id = 'invisible-recaptcha-container';
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      
      // Start MFA verification with skipRecaptcha=true
      const verId = await startMfaVerification(
        resolver,
        recaptchaVerifierRef.current || createRecaptchaVerifier('invisible-recaptcha-container', 'invisible'),
        true // Skip recaptcha for initial code sending
      );
      
      setVerificationId(verId);
      setSuccess("Verification code sent to your phone.");
    } catch (error: any) {
      console.error("Error sending verification code automatically:", error);
      
      // Check for specific error types
      if (error.message && (
          error.message.includes("CAPTCHA_CHECK_FAILED") || 
          error.message.includes("Hostname match not found") ||
          error.message.includes("reCAPTCHA") ||
          error.code === "auth/captcha-check-failed"
        )) {
        setError(
          "Domain verification failed. Please try again or use the manual verification option below."
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
      
      // Initialize recaptcha for manual verification
      initializeRecaptcha();
    } finally {
      setIsSendingCode(false);
    }
  };

  // Function to manually send verification code with CAPTCHA (for resending)
  const sendVerificationCode = async () => {
    setError(null);
    setSuccess(null);
    setIsSendingCode(true);
    
    try {
      if (!recaptchaVerifierRef.current) {
        throw new Error("Security verification not initialized. Please refresh the page.");
      }
      
      // Start MFA verification with the visible recaptcha
      const verId = await startMfaVerification(
        resolver,
        recaptchaVerifierRef.current,
        false // Don't skip recaptcha for manual resending
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
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          A verification code has been sent automatically to your phone. Enter the code to complete sign-in.
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleVerifyCode}>
        <CardContent className="space-y-4">
          {/* Status messages */}
          {error && (
            <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 text-sm rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
              {success}
            </div>
          )}
          
          {isSendingCode && !error && !success && (
            <div className="p-3 text-sm rounded-md bg-green-500/10 text-green-600 dark:text-green-400 flex items-center">
              <div className="w-4 h-4 mr-2 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin"></div>
              Sending verification code to your phone...
            </div>
          )}
          
          {/* Verification code input */}
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
              autoFocus={!!verificationId} // Auto-focus when code has been sent
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to your phone
            </p>
          </div>
          
          {/* CAPTCHA for resending code */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Need to resend the code? Complete the CAPTCHA verification below.
            </p>
            <div id="mfa-recaptcha-container" ref={recaptchaContainerRef} className="flex justify-center"></div>
          </div>
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