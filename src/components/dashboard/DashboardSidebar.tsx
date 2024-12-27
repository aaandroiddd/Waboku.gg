import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function DashboardSidebar() {
  const router = useRouter();
  const { signOut } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Create Listing', href: '/dashboard/create-listing' },
    { name: 'Favorites', href: '/dashboard/favorites' },
    { name: 'Messages', href: '/dashboard/messages' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];

  return (
    <div className="flex flex-col w-64 bg-card border-r">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex-1 px-3 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'text-sm font-medium rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground',
                router.pathname === item.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}