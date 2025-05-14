import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ErrorCard, ProfileContent } from '@/components/ProfileContent';

export default function ProfileByUsernamePage() {
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

    const { username } = router.query;
    
    if (!username) {
      setError('Invalid username');
      setIsLoading(false);
      return;
    }

    const fetchUserId = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Call our API to get the user ID from username
        const response = await fetch(`/api/users/get-by-username?username=${encodeURIComponent(username as string)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`User "${username}" not found`);
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
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
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