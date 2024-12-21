import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  LayoutDashboard,
  ListPlus,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };

  const handleNavigation = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const isActive = (path: string) => router.pathname === path;

  return (
    <div className="h-full min-h-screen w-full bg-card border-r flex flex-col">
      <div className="p-6">
        <Logo href="/" className="w-full" />
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        <Link href="/dashboard" passHref>
          <Button
            variant={isActive("/dashboard") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={handleNavigation}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>

        <Link href="/dashboard/create-listing" passHref>
          <Button
            variant={isActive("/dashboard/create-listing") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={handleNavigation}
          >
            <ListPlus className="mr-2 h-4 w-4" />
            Create Listing
          </Button>
        </Link>

        <Link href="/dashboard/messages" passHref>
          <Button
            variant={isActive("/dashboard/messages") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={handleNavigation}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </Button>
        </Link>

        <Link href="/dashboard/settings" passHref>
          <Button
            variant={isActive("/dashboard/settings") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={handleNavigation}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Link>
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}