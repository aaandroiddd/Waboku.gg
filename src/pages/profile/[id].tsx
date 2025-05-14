import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorCard, ProfileContent } from '@/components/ProfileContent';
import { useProfile } from '@/hooks/useProfile';

/**
 * Legacy profile page that uses user ID
 * This page will be redirected to the username-based profile page by middleware
 * but is kept for backward compatibility
 */
export default function ProfileByIdPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !router.isReady) {
    return <LoadingScreen />;
  }

  const { id } = router.query;
  const userId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : null;

  if (!userId) {
    return <ErrorCard message="Invalid Profile ID" />;
  }

  return <ProfileContent userId={userId} />;
}