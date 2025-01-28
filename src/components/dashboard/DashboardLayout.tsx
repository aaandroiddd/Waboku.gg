import { ReactNode, useState } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Footer } from '../Footer';
import { VerificationStatus } from '../VerificationStatus';
import { SellerBadge } from '../SellerBadge';
import { AdminBadge } from '../AdminBadge';
import { useContext } from 'react';
import { AccountContext } from '@/contexts/AccountContext';

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-72 flex-shrink-0">
          <DashboardSidebar />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="md:hidden fixed top-4 left-4 z-40"
              size="icon"
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <DashboardSidebar onNavigate={() => setIsSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 md:p-8 pt-16 md:pt-8">
              <div className="flex flex-wrap gap-2 items-center">
                <VerificationStatus />
                {useContext(AccountContext)?.account?.isAdmin && <AdminBadge />}
              </div>
            </div>
            <main className="flex-1 min-h-0">
              {children}
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}