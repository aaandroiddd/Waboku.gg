import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

const DashboardComponent = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    } else if (!loading && user && !user.emailVerified) {
      router.replace({
        pathname: '/auth/verify-resend',
        query: { email: user.email }
      });
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Welcome to your Dashboard</h1>
        <p>Start managing your listings and trades here.</p>
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false
});