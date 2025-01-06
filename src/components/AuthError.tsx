import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthErrorProps } from "@/types/auth";

const AuthError: React.FC<AuthErrorProps> = ({ error, errorCode, onClose }) => {
  if (!error) return null;

  // Extract Firebase error code from the error message if not provided
  const code = errorCode || error.message.match(/\(([^)]+)\)/)?.[1] || "unknown";

  const getErrorContent = () => {
    switch (code) {
      case "auth/wrong-password":
        return {
          title: "Incorrect Password",
          description: (
            <>
              The password you entered is incorrect.{" "}
              <Link
                href="/auth/forgot-password"
                className="text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </>
          ),
        };

      case "auth/user-not-found":
      case "auth/invalid-login-credentials":  // Firebase sometimes returns this code instead
      case "auth/invalid-credential":  // New Firebase error code
        return {
          title: "Account Not Found",
          description: (
            <>
              We couldn't find an account with this email.{" "}
              <Link href="/auth/sign-up" className="text-primary hover:underline">
                Create a new account
              </Link>
            </>
          ),
        };

      case "auth/invalid-email":
        return {
          title: "Invalid Email",
          description: "Please enter a valid email address.",
        };

      case "auth/network-request-failed":
        return {
          title: "Connection Error",
          description:
            "Please check your internet connection and try again.",
        };

      case "auth/too-many-requests":
        return {
          title: "Too Many Attempts",
          description:
            "Access temporarily blocked due to many failed attempts. Please try again later or reset your password.",
        };

      case "auth/email-already-in-use":
        return {
          title: "Email Already Registered",
          description: (
            <>
              This email is already registered.{" "}
              <Link href="/auth/sign-in" className="text-primary hover:underline">
                Sign in instead
              </Link>
            </>
          ),
        };

      case "auth/missing-fields":
        return {
          title: "Missing Information",
          description: "Please enter both email and password.",
        };

      default:
        console.error("Unhandled auth error code:", code);
        return {
          title: "Authentication Error",
          description: error.message || "An unexpected error occurred. Please try again.",
        };
    }
  };

  const errorContent = getErrorContent();

  return (
    <Alert variant="destructive" className="relative">
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={onClose}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      )}
      <AlertTitle className="flex items-center gap-2">
        <XCircle className="h-4 w-4" />
        {errorContent.title}
      </AlertTitle>
      <AlertDescription>{errorContent.description}</AlertDescription>
    </Alert>
  );
};

export default AuthError;