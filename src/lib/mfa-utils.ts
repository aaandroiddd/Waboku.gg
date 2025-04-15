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
  size: "invisible" | "normal" = "invisible",
  callback?: (response: string) => void
): RecaptchaVerifier => {
  const auth = getAuth();
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
      }
    }
  );
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
  } catch (error) {
    console.error("Error starting MFA enrollment:", error);
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
  } catch (error) {
    console.error("Error starting MFA verification:", error);
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