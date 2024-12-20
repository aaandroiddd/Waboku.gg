import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Mail } from "lucide-react";
import dynamic from 'next/dynamic';

const VerifyEmailComponent = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      router.push("/auth/sign-in");
    } else if (user.emailVerified) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleResendVerification = async () => {
    if (!user?.email) return;

    try {
      const { error } = await resendVerificationEmail(user.email);
      
      if (error) {
        toast({
          title: "Error sending verification email",
          description: error.message || "Please try again later.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Error sending verification email",
        description: error.message || "Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!user) return null;

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification email to {user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Please check your inbox and click the verification link to activate your account.
            If you don&apos;t see the email, check your spam folder.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleResendVerification}>
              Resend verification email
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Export with dynamic import to disable SSR
export default dynamic(() => Promise.resolve(VerifyEmailComponent), {
  ssr: false
});