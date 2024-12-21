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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const navigationItems = [
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard"
    },
    {
      href: "/dashboard/create-listing",
      icon: ListPlus,
      label: "Create Listing"
    },
    {
      href: "/dashboard/messages",
      icon: MessageSquare,
      label: "Messages"
    },
    {
      href: "/dashboard/settings",
      icon: Settings,
      label: "Settings"
    }
  ];

  return (
    <div className="h-full min-h-screen w-16 bg-card border-r flex flex-col items-center py-4">
      <div className="w-full flex justify-center mb-8">
        <Logo href="/" className="w-8 h-8" />
      </div>
      
      <nav className="flex-1 space-y-4">
        <TooltipProvider>
          {navigationItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link href={item.href} passHref>
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    size="icon"
                    className="w-10 h-10"
                    onClick={handleNavigation}
                  >
                    <item.icon className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Sign Out</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}