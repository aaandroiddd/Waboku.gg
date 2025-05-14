import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorCard, ProfileContent } from '@/components/ProfileContent';

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const { slug } = router.query;
    
    if (!slug) {
      setError('Invalid profile identifier');
      setIsLoading(false);
      return;
    }

    const slugStr = typeof slug === 'string' ? slug : Array.isArray(slug) ? slug[0] : null;
    
    if (!slugStr) {
      setError('Invalid profile identifier');
      setIsLoading(false);
      return;
    }

    // Check if the slug looks like a Firebase UID (alphanumeric, typically 28 chars)
    // If it does, use it directly as the userId
    if (slugStr.length > 20 && /^[a-zA-Z0-9]+$/.test(slugStr)) {
      setUserId(slugStr);
      setIsLoading(false);
      return;
    }

    // Otherwise, assume it's a username and fetch the corresponding userId
    const fetchUserId = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Call our API to get the user ID from username
        const response = await fetch(`/api/users/get-by-username?username=${encodeURIComponent(slugStr)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`User "${slugStr}" not found`);
          } else {
            const data = await response.json();
            setError(data.error || 'Failed to fetch user');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setUserId(data.userId);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching user ID:', err);
        setError('Failed to load profile. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchUserId();
  }, [router.isReady, router.query]);

  if (!mounted || !router.isReady) {
    return <LoadingScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <ErrorCard 
          message={error} 
          onRetry={() => {
            setIsLoading(true);
            router.reload();
          }}
        />
      </div>
    );
  }

  return <ProfileContent userId={userId} />;
}