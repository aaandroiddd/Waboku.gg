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
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
}

export function DashboardSidebar({ onNavigate, isMobile = false }: DashboardSidebarProps) {
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

  const NavButton = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const active = isActive(href);
    
    if (isMobile) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={href} passHref>
                <Button
                  variant={active ? "default" : "ghost"}
                  size="icon"
                  className="w-10 h-10"
                  onClick={handleNavigation}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link href={href} passHref>
        <Button
          variant={active ? "default" : "ghost"}
          className="w-full justify-start"
          onClick={handleNavigation}
        >
          <Icon className="h-5 w-5 mr-3" />
          {label}
        </Button>
      </Link>
    );
  };

  return (
    <div className={cn(
      "h-full min-h-screen bg-card border-r flex flex-col",
      isMobile ? "w-16 items-center py-4" : "w-64 p-4"
    )}>
      <div className={cn(
        "w-full",
        isMobile ? "flex justify-center mb-8" : "px-4 py-2 mb-6"
      )}>
        <Logo href="/" className={isMobile ? "w-8 h-8" : "w-full"} />
      </div>
      
      <nav className={cn(
        "flex-1",
        isMobile ? "space-y-4" : "space-y-2"
      )}>
        {navigationItems.map((item) => (
          <NavButton
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      {isMobile ? (
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
      ) : (
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}