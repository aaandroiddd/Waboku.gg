import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AuthNav() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>('User');

  // Update display name when user or profile changes
  useEffect(() => {
    if (user) {
      // Priority order: profile username > user displayName > user email > 'User'
      const name = profile?.username || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
      setDisplayName(name);
    } else {
      setDisplayName('User');
    }
  }, [user, profile]);

  if (user) {
    return (
      <>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">
            Welcome, {displayName}!
          </span>
          <div className="flex items-center space-x-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/dashboard/create-listing">
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700">
                <Plus className="h-4 w-4" />
                Create Listing
              </Button>
            </Link>
          </div>
        </div>
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