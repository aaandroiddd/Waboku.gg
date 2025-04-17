import { useRouter } from 'next/router';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ListingGrid } from '@/components/ListingGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Youtube, Twitter, Facebook, ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { SellerBadge } from '@/components/SellerBadge';
import { AdminBadge } from '@/components/AdminBadge';
import { MessageDialog } from '@/components/MessageDialog';
import { StripeSellerBadge } from '@/components/StripeSellerBadge';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ProfileName } from '@/components/ProfileName';
import { UserReviewsTabs } from '@/components/UserReviewsTabs';

const LoadingProfile = () => (
  <div className="container mx-auto p-6">
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/4">
            <div className="animate-pulse bg-secondary aspect-square rounded-lg"></div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="animate-pulse h-8 bg-secondary rounded w-1/3"></div>
            <div className="animate-pulse h-4 bg-secondary rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-secondary rounded-lg h-24"></div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const ErrorCard = ({ message, onRetry, isOffline }: { message: string; onRetry?: () => void; isOffline?: boolean }) => (
  <div className="container mx-auto p-6">
    <Card>
      <CardContent className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            {isOffline ? "You're currently offline" : message}
          </h1>
          <p className="text-muted-foreground mb-4">
            {isOffline 
              ? "We couldn't load this profile because your device appears to be offline. Please check your internet connection and try again."
              : "Please try again later or contact support if the issue persists."}
          </p>
          {onRetry && (
            <Button 
              variant="outline" 
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);

const ProfileContent = ({ userId }: { userId: string | null }) => {
  if (!userId) {
    return <ErrorCard message="Invalid Profile ID" />;
  }
  const { user, checkVerificationStatus } = useAuth();
  const router = useRouter();
  const { profile, isLoading, error, isOffline } = useProfile(userId);
  const [mounted, setMounted] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>(
    typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'online'
  );

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user && user.uid === userId) {
      checkVerificationStatus();
    }
  }, [user, userId, checkVerificationStatus]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingProfile />;
  }

  if (isLoading) {
    return <LoadingProfile />;
  }

  // Handle offline state
  if (isOffline || networkStatus === 'offline') {
    return <ErrorCard 
      message="Connection Error" 
      isOffline={true}
      onRetry={() => window.location.reload()}
    />;
  }

  if (error || !profile) {
    return <ErrorCard 
      message={error || 'Profile not found'} 
      onRetry={() => window.location.reload()}
    />;
  }

  const joinDate = profile.joinDate ? format(new Date(profile.joinDate), 'MMMM yyyy') : 'Unknown';

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-6 flex-grow">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/4 flex flex-col gap-4">
                {/* Custom ProfileAvatar component for profile page */}
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                  {/* We're using a wrapper div to maintain the aspect ratio */}
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.username || 'User avatar'}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                      loading="eager"
                      quality={80}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/default-avatar.svg';
                      }}
                    />
                  ) : (
                    <Image
                      src="/images/default-avatar.svg"
                      alt="Default avatar"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      priority
                      className="object-cover"
                    />
                  )}
                </div>
                {/* Message button for mobile */}
                {user && user.uid !== userId && (
                  <div className="md:hidden w-full">
                    <MessageDialog
                      recipientId={userId}
                      recipientName={profile.username || 'User'}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div className="w-full">
                    {/* Username centered on its own line */}
                    <h1 className="text-2xl md:text-3xl font-bold text-center mb-3">{profile.username || 'Anonymous User'}</h1>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 mb-2">
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <SellerBadge userId={userId} />
                        <StripeSellerBadge userId={userId} />
                        {profile.isAdmin && <AdminBadge />}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-center sm:text-left">Member since {joinDate}</p>
                  </div>
                  {/* Message button for desktop */}
                  {user && user.uid !== userId && (
                    <div className="hidden md:block mt-4 md:mt-0">
                      <MessageDialog
                        recipientId={userId}
                        recipientName={profile.username || 'User'}
                      />
                    </div>
                  )}
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">{profile.totalSales || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                  </div>
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">{profile.rating || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Rating</div>
                  </div>
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-sm font-medium">{profile.location || 'Not specified'}</div>
                    <div className="text-sm text-muted-foreground">Location</div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold mb-2">About</h2>
                    <div className="text-muted-foreground space-y-4">
                      {profile.bio ? 
                        profile.bio.split('\n').map((paragraph, index) => (
                          <p key={index} className={paragraph.trim() === '' ? 'h-4' : ''}>
                            {paragraph}
                          </p>
                        ))
                        : 'This user hasn\'t added a bio yet.'
                      }
                    </div>
                  </div>

                  {profile.contact && (
                    <div>
                      <h2 className="font-semibold mb-2">Contact</h2>
                      <p className="text-muted-foreground">{profile.contact}</p>
                    </div>
                  )}

                  {profile.social && (
                    <div>
                      <h2 className="font-semibold mb-2">Social Links</h2>
                      <div className="flex flex-wrap gap-4">
                        {profile.social.youtube && (
                          <a 
                            href={profile.social.youtube} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 text-muted-foreground hover:text-[#FF0000] transition-colors"
                          >
                            <Youtube className="h-5 w-5" />
                            <span className="text-sm md:text-base">YouTube</span>
                          </a>
                        )}
                        {profile.social.twitter && (
                          <a 
                            href={profile.social.twitter} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                          >
                            <Twitter className="h-5 w-5" />
                            <span className="text-sm md:text-base">X (Twitter)</span>
                          </a>
                        )}
                        {profile.social.facebook && (
                          <a 
                            href={profile.social.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 text-muted-foreground hover:text-[#4267B2] transition-colors"
                          >
                            <Facebook className="h-5 w-5" />
                            <span className="text-sm md:text-base">Facebook</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="listings" className="w-full">
          <TabsList>
            <TabsTrigger value="listings">Active Listings</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          
          <TabsContent value="listings">
            <div className="mt-6">
              <ListingGrid userId={userId} showOnlyActive={true} />
            </div>
          </TabsContent>
          
          <TabsContent value="reviews">
            {userId && <UserReviewsTabs userId={userId} />}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !router.isReady) {
    return <LoadingProfile />;
  }

  const { id } = router.query;
  const userId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : null;

  if (!userId) {
    return <ErrorCard message="Invalid Profile ID" />;
  }

  return <ProfileContent userId={userId} />;
}