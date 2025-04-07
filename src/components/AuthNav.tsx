import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { useRouter } from "next/router";

export default function AuthNav() {
  const { user, profile } = useAuth();
  const router = useRouter();

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