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
  recaptchaVerifier: RecaptchaVerifier
): Promise<string> => {
  try {
    // Get the first hint (we'll use the first enrolled factor)
    const hint = resolver.hints[0];
    
    // Create phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(getAuth());
    
    // Send verification code
    return await phoneAuthProvider.verifyPhoneNumber(
      {
        multiFactorHint: hint,
        session: resolver.session
      },
      recaptchaVerifier
    );
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
    }
    
    throw error;
  }
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