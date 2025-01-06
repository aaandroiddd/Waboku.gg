export type AuthErrorCode =
  | "auth/invalid-email"
  | "auth/user-disabled"
  | "auth/user-not-found"
  | "auth/wrong-password"
  | "auth/email-already-in-use"
  | "auth/weak-password"
  | "auth/network-request-failed"
  | "auth/too-many-requests"
  | "auth/popup-closed-by-user"
  | "auth/requires-recent-login"
  | "auth/invalid-credential";

export interface AuthErrorProps {
  error: Error | null;
  errorCode?: AuthErrorCode;
  onClose?: () => void;
}