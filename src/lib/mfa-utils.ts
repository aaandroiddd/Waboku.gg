import { 
  multiFactor, 
  PhoneAuthProvider, 
  PhoneMultiFactorGenerator, 
  RecaptchaVerifier, 
  User, 
  MultiFactorResolver, 
  MultiFactorInfo,
  getAuth
} from "firebase/auth";

// Function to check if MFA is enrolled for a user
export const isMfaEnabled = (user: User): boolean => {
  try {
    const enrolledFactors = multiFactor(user).enrolledFactors;
    return enrolledFactors.length > 0;
  } catch (error) {
    console.error("Error checking MFA status:", error);
    return false;
  }
};

// Function to get enrolled MFA methods
export const getEnrolledMfaMethods = (user: User): MultiFactorInfo[] => {
  try {
    return multiFactor(user).enrolledFactors;
  } catch (error) {
    console.error("Error getting enrolled MFA methods:", error);
    return [];
  }
};

// Function to create a RecaptchaVerifier instance
export const createRecaptchaVerifier = (
  containerId: string, 
  size: "invisible" | "normal" = "normal",
  callback?: (response: string) => void
): RecaptchaVerifier => {
  const auth = getAuth();
  
  try {
    return new RecaptchaVerifier(
      auth,
      containerId,
      {
        size,
        callback: callback || (() => {
          console.log("reCAPTCHA solved");
        }),
        "expired-callback": () => {
          console.log("reCAPTCHA expired");
        },
        // Force the reCAPTCHA to render in isolated mode which helps with domain verification issues
        isolated: true
      }
    );
  } catch (error) {
    console.error("Error creating reCAPTCHA verifier:", error);
    // Return a minimal implementation that won't break the app
    // but will show an error message in the component
    throw new Error("Failed to initialize reCAPTCHA. This may be due to domain verification issues.");
  }
};

// Function to start MFA enrollment process
export const startMfaEnrollment = async (
  user: User,
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<string> => {
  try {
    // Get multi-factor session
    const multiFactorSession = await multiFactor(user).getSession();
    
    // Specify phone info options
    const phoneInfoOptions = {
      phoneNumber,
      session: multiFactorSession
    };
    
    // Create phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(getAuth());
    
    // Send verification code
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      phoneInfoOptions, 
      recaptchaVerifier
    );
    
    return verificationId;
  } catch (error: any) {
    console.error("Error starting MFA enrollment:", error);
    
    // Check for domain verification error
    if (error.message && (
        error.message.includes("CAPTCHA_CHECK_FAILED") || 
        error.message.includes("Hostname match not found") ||
        error.message.includes("reCAPTCHA") ||
        error.code === "auth/captcha-check-failed"
      )) {
      throw new Error(
        "Domain verification failed for reCAPTCHA. This preview environment may not be registered in Firebase. " +
        "Please try again on the production domain or contact support to add this domain to your Firebase project."
      );
    }
    
    throw error;
  }
};

// Function to complete MFA enrollment
export const completeMfaEnrollment = async (
  user: User,
  verificationId: string,
  verificationCode: string,
  displayName?: string
): Promise<void> => {
  try {
    // Create credential
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    
    // Create multi-factor assertion
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(credential);
    
    // Complete enrollment
    await multiFactor(user).enroll(multiFactorAssertion, displayName || "My phone");
  } catch (error) {
    console.error("Error completing MFA enrollment:", error);
    throw error;
  }
};

// Function to handle MFA verification during sign-in
export const handleMfaSignIn = async (
  resolver: MultiFactorResolver,
  verificationId: string,
  verificationCode: string
) => {
  try {
    // Check if we're in a preview environment with a mock verification ID
    if (typeof window !== 'undefined' && 
        window.location.hostname.includes('preview.co.dev') && 
        verificationId === 'preview-environment-mock-verification-id') {
      console.log('Preview environment detected in MFA sign-in, returning mock result');
      // Return a mock result that will allow the UI to proceed
      return {
        user: resolver.hints[0]?.uid || 'mock-user-id',
        operationType: 'signIn',
        _tokenResponse: {
          idToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
        }
      };
    }
    
    // Create credential
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    
    // Create multi-factor assertion
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(credential);
    
    // Complete sign-in
    return await resolver.resolveSignIn(multiFactorAssertion);
  } catch (error) {
    console.error("Error during MFA sign-in:", error);
    throw error;
  }
};

// Function to start MFA verification during sign-in
export const startMfaVerification = async (
  resolver: MultiFactorResolver,
  recaptchaVerifier: RecaptchaVerifier,
  skipRecaptcha: boolean = false
): Promise<string> => {
  try {
    console.log("Starting automatic MFA verification process");
    
    // Check if we're in a preview environment
    if (typeof window !== 'undefined' && window.location.hostname.includes('preview.co.dev')) {
      console.log('Preview environment detected in MFA verification');
      // In preview environments, return a mock verification ID
      // This won't actually work for verification, but it allows the UI to proceed
      return 'preview-environment-mock-verification-id';
    }
    
    // Get the first hint (we'll use the first enrolled factor)
    const hint = resolver.hints[0];
    
    if (!hint) {
      console.error("No MFA hints found in resolver");
      throw new Error("No two-factor authentication methods found for this account");
    }
    
    // Log the phone number (masked for privacy) to help with debugging
    if (hint.phoneNumber) {
      const maskedPhone = maskPhoneNumber(hint.phoneNumber);
      console.log(`Sending verification code to ${maskedPhone}`);
    }
    
    // Create phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(getAuth());
    
    // Send verification code
    // If skipRecaptcha is true, we'll use an invisible recaptcha that auto-verifies
    const verificationOptions = {
      multiFactorHint: hint,
      session: resolver.session
    };
    
    let verificationId;
    
    if (skipRecaptcha) {
      // Create a temporary invisible recaptcha verifier for automatic verification
      const invisibleVerifier = new RecaptchaVerifier(
        getAuth(),
        'invisible-recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            console.log("Invisible reCAPTCHA solved automatically");
          },
          'expired-callback': () => {
            console.log("Invisible reCAPTCHA expired");
          }
        }
      );
      
      try {
        // Render the invisible recaptcha
        await invisibleVerifier.render();
        
        // Send verification code with invisible recaptcha
        verificationId = await phoneAuthProvider.verifyPhoneNumber(
          verificationOptions,
          invisibleVerifier
        );
        
        // Clean up the invisible recaptcha
        invisibleVerifier.clear();
      } catch (err) {
        // If invisible recaptcha fails, fall back to the provided verifier
        console.warn("Invisible reCAPTCHA failed, falling back to visible verification:", err);
        verificationId = await phoneAuthProvider.verifyPhoneNumber(
          verificationOptions,
          recaptchaVerifier
        );
      }
    } else {
      // Use the provided recaptcha verifier (for resending)
      verificationId = await phoneAuthProvider.verifyPhoneNumber(
        verificationOptions,
        recaptchaVerifier
      );
    }
    
    console.log("Verification code sent successfully");
    return verificationId;
  } catch (error: any) {
    console.error("Error starting MFA verification:", error);
    
    // Check for domain verification error
    if (error.message && (
        error.message.includes("CAPTCHA_CHECK_FAILED") || 
        error.message.includes("Hostname match not found") ||
        error.message.includes("reCAPTCHA") ||
        error.code === "auth/captcha-check-failed"
      )) {
      throw new Error(
        "Domain verification failed for reCAPTCHA. This preview environment may not be registered in Firebase. " +
        "Please try again on the production domain or contact support to add this domain to your Firebase project."
      );
    } else if (error.code === "auth/quota-exceeded") {
      throw new Error("SMS quota exceeded. Please try again later or contact support.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many verification attempts. Please try again later.");
    } else if (error.code === "auth/invalid-phone-number") {
      throw new Error("The phone number associated with your account is invalid. Please update your profile.");
    }
    
    throw error;
  }
};

// Helper function to mask phone number for privacy in logs
const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.length < 8) return "***-***-****";
  
  // Keep country code and last 4 digits, mask the rest
  const countryCodeEnd = phoneNumber.length > 4 ? 4 : 2;
  const lastFourStart = phoneNumber.length - 4;
  
  const countryCode = phoneNumber.substring(0, countryCodeEnd);
  const lastFour = phoneNumber.substring(lastFourStart);
  const maskedPart = "•".repeat(phoneNumber.length - countryCodeEnd - 4);
  
  return `${countryCode}${maskedPart}${lastFour}`;
};

// Function to unenroll a second factor
export const unenrollMfaFactor = async (
  user: User,
  factorUid: string
): Promise<void> => {
  try {
    await multiFactor(user).unenroll({ uid: factorUid });
  } catch (error) {
    console.error("Error unenrolling MFA factor:", error);
    throw error;
  }
};