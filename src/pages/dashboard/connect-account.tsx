import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ConnectAccountRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Preserve any query parameters when redirecting
    const query = router.query;
    const queryString = Object.keys(query).length > 0 
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}` 
      : '';
    
    // Redirect to the new path
    router.replace(`/dashboard/seller-account${queryString}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to Seller Account page...</p>
    </div>
  );
}