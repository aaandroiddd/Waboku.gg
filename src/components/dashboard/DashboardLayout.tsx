import { ReactNode } from 'react';
import { DashboardSidebar } from './DashboardSidebar';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}