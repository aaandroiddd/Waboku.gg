import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import Link from "next/link";
import { LogOut, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/router";

export default function AuthNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (user) {
    return (
      <>
        <Link href="/dashboard">
          <Button variant="ghost" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
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