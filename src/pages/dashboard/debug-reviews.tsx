import { ReviewDebugger } from '@/components/ReviewDebugger';
import { ReviewInspector } from '@/components/ReviewInspector';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ReviewDebugPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Review System Debugger</h1>
          <p className="text-muted-foreground">
            Test and debug the review system
          </p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList>
            <TabsTrigger value="create">Create Test Reviews</TabsTrigger>
            <TabsTrigger value="inspect">Inspect Reviews</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <ReviewDebugger />
          </TabsContent>
          
          <TabsContent value="inspect">
            <ReviewInspector />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}