import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import Link from "next/link";
import { LogOut, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { SignOutDialog } from "./SignOutDialog";

export default function AuthNav() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (user) {
    return (
      <>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">
            Welcome, {profile?.username || 'User'}!
          </span>
          <div className="flex items-center space-x-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setShowSignOutDialog(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
        <SignOutDialog
          isOpen={showSignOutDialog}
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutDialog(false)}
        />
      </>
    );
  }

  return (
    <>
      <Link href="/auth/sign-in">
        <Button variant="ghost">Sign In</Button>
      </Link>
      <Link href="/auth/sign-up">
        <Button className="bg-sky-400 hover:bg-sky-500">Get Started</Button>
      </Link>
    </>
  );
}