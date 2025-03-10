import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WantedPostsSection } from '@/components/dashboard/WantedPostsSection';
import { WantedPostsDebugger } from '@/components/dashboard/WantedPostsDebugger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const WantedDashboardPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
            <Button
              onClick={() => router.push('/auth/sign-in')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight pl-5">Wanted Posts</h1>
          <p className="text-muted-foreground mt-1 pl-5">
            Manage your wanted posts for cards and accessories you're looking to buy or trade for.
          </p>
        </div>
        
        <WantedPostsSection />
        
        <div className="mt-6">
          <WantedPostsDebugger />
        </div>
      </div>
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(WantedDashboardPage), {
  ssr: false
});