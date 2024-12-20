import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "./ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const currentPath = router.pathname;

  const navigation = [
    { name: "Active Listings", href: "/dashboard" },
    { name: "Favorites", href: "/dashboard/favorites" },
    { name: "Messages", href: "/dashboard/messages" },
    { name: "Profile", href: "/dashboard/profile" },
  ];

  const handleSignOut = () => {
    // TODO: Implement actual sign out
    router.push("/auth/sign-in");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card min-h-screen p-4 space-y-4 border-r">
          <div className="space-y-4">
            <h2 className="text-lg font-bold px-4">Dashboard</h2>
            <nav className="space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-4 py-2 rounded-lg ${
                    currentPath === item.href
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <Button
              variant="outline"
              className="w-[calc(100%-2rem)]"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}