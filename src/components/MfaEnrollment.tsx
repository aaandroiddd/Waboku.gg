import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { RecaptchaVerifier } from "firebase/auth";
import { 
  createRecaptchaVerifier, 
  startMfaEnrollment, 
  completeMfaEnrollment,
  isMfaEnabled,
  getEnrolledMfaMethods,
  unenrollMfaFactor
} from "@/lib/mfa-utils";

export default function MfaEnrollment() {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrolledFactors, setEnrolledFactors] = useState<any[]>([]);
  const [step, setStep] = useState<"phone" | "code" | "complete">("phone");
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (user) {
      const mfaStatus = isMfaEnabled(user);
      setMfaEnabled(mfaStatus);
      
      if (mfaStatus) {
        const factors = getEnrolledMfaMethods(user);
        setEnrolledFactors(factors);
      }
    }
  }, [user]);

  const initializeRecaptcha = () => {
    if (!recaptchaContainerRef.current) return;
    
    try {
      // Clear any existing reCAPTCHA
      recaptchaContainerRef.current.innerHTML = "";
      
      // Create new reCAPTCHA verifier with normal size (not invisible)
      // and set isolated mode to true to help with domain verification issues
      recaptchaVerifierRef.current = createRecaptchaVerifier("recaptcha-container", "normal");
      
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
    if (step === "phone") {
      initializeRecaptcha();
    }
    
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
  }, [step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    if (!user) {
      setError("You must be logged in to enable two-factor authentication.");
      setIsLoading(false);
      return;
    }
    
    if (!phoneNumber) {
      setError("Please enter your phone number.");
      setIsLoading(false);
      return;
    }
    
    try {
      if (!recaptchaVerifierRef.current) {
        throw new Error("Security verification not initialized. Please refresh the page.");
      }
      
      // Format phone number if needed
      let formattedPhoneNumber = phoneNumber;
      if (!phoneNumber.startsWith("+")) {
        formattedPhoneNumber = "+1" + phoneNumber; // Default to US if no country code
      }
      
      // Start MFA enrollment
      const verId = await startMfaEnrollment(
        user,
        formattedPhoneNumber,
        recaptchaVerifierRef.current
      );
      
      setVerificationId(verId);
      setSuccess("Verification code sent to your phone.");
      setStep("code");
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
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    if (!user) {
      setError("You must be logged in to enable two-factor authentication.");
      setIsLoading(false);
      return;
    }
    
    if (!verificationId) {
      setError("Verification session expired. Please start over.");
      setIsLoading(false);
      setStep("phone");
      return;
    }
    
    if (!verificationCode) {
      setError("Please enter the verification code.");
      setIsLoading(false);
      return;
    }
    
    try {
      // Complete MFA enrollment
      await completeMfaEnrollment(
        user,
        verificationId,
        verificationCode,
        displayName || "My phone"
      );
      
      setSuccess("Two-factor authentication enabled successfully!");
      setMfaEnabled(true);
      setEnrolledFactors(getEnrolledMfaMethods(user));
      setStep("complete");
      
      // Reset form
      setPhoneNumber("");
      setVerificationCode("");
      setVerificationId(null);
      setDisplayName("");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      setError(error.message || "Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMfa = async (factorUid: string) => {
    if (!user) {
      setError("You must be logged in to disable two-factor authentication.");
      return;
    }
    
    if (!confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await unenrollMfaFactor(user, factorUid);
      setSuccess("Two-factor authentication disabled successfully.");
      setMfaEnabled(false);
      setEnrolledFactors([]);
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      setError(error.message || "Failed to disable two-factor authentication. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          You must be logged in to manage two-factor authentication.
        </AlertDescription>
      </Alert>
    );
  }

  if (mfaEnabled && step === "phone") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Your account is protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrolledFactors.map((factor, index) => (
            <div key={factor.uid} className="flex items-center justify-between mb-4 p-3 border rounded">
              <div>
                <p className="font-medium">{factor.displayName || "Phone number"}</p>
                <p className="text-sm text-muted-foreground">
                  {factor.phoneNumber ? `${factor.phoneNumber.substring(0, 4)}•••${factor.phoneNumber.substring(factor.phoneNumber.length - 4)}` : "Phone authentication"}
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleDisableMfa(factor.uid)}
                disabled={isLoading}
              >
                {isLoading ? "Removing..." : "Remove"}
              </Button>
            </div>
          ))}
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mt-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mfaEnabled ? "Manage Two-Factor Authentication" : "Enable Two-Factor Authentication"}
        </CardTitle>
        <CardDescription>
          {mfaEnabled 
            ? "Add another phone number or remove existing two-factor authentication." 
            : "Protect your account with two-factor authentication using your phone."}
        </CardDescription>
      </CardHeader>
      
      {step === "phone" && (
        <form onSubmit={handleSendCode}>
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
              <label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Include your country code (e.g., +1 for US/Canada)
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="display-name" className="text-sm font-medium">
                Display Name (Optional)
              </label>
              <Input
                id="display-name"
                type="text"
                placeholder="My personal phone"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                A name to identify this phone number
              </p>
            </div>
            
            <div id="recaptcha-container" ref={recaptchaContainerRef} className="flex justify-center"></div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending Code..." : "Send Verification Code"}
            </Button>
          </CardFooter>
        </form>
      )}
      
      {step === "code" && (
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
            
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                disabled={isLoading}
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code sent to your phone
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify Code"}
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full"
              onClick={() => {
                setStep("phone");
                setVerificationId(null);
                setVerificationCode("");
                initializeRecaptcha();
              }}
              disabled={isLoading}
            >
              Back
            </Button>
          </CardFooter>
        </form>
      )}
      
      {step === "complete" && (
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
          
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Two-Factor Authentication Enabled</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your account is now protected with two-factor authentication.
              You'll need to enter a verification code when signing in.
            </p>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => {
              setStep("phone");
              setSuccess(null);
            }}
          >
            Done
          </Button>
        </CardContent>
      )}
    </Card>
  );
}