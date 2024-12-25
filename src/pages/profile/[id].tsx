import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import ListingGrid from '@/components/ListingGrid';

interface UserProfile {
  id: string;
  username: string;
  joinDate: string;
  location: string;
  totalSales: number;
  rating: number;
  bio: string;
  avatarUrl: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!id) return;
      
      try {
        // Mock data for demonstration
        const profileData = {
          id: id as string,
          username: "CardMaster2024",
          joinDate: "December 2023",
          location: "New York, NY",
          totalSales: 156,
          rating: 4.8,
          bio: "Passionate TCG collector and trader. Specializing in rare Pokemon and Yu-Gi-Oh cards.",
          avatarUrl: "https://assets.co.dev/171838d1-5208-4d56-8fa3-d46502238350/image-82bb4ad.png"
        };

        if (isMounted) {
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!id) {
    return null; // Return null on initial render when id is not available
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-64 bg-secondary rounded-lg mb-4"></div>
          <div className="h-8 bg-secondary rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-secondary rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold text-center">Profile not found</h1>
            <p className="text-center text-muted-foreground mt-2">
              The requested profile could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/4">
              <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                <Image
                  src={profile.avatarUrl}
                  alt={profile.username}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  priority
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{profile.username}</h1>
                  <p className="text-muted-foreground">Member since {profile.joinDate}</p>
                </div>
                <Button variant="secondary">Message</Button>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold">{profile.totalSales}</div>
                  <div className="text-sm text-muted-foreground">Total Sales</div>
                </div>
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold">{profile.rating}</div>
                  <div className="text-sm text-muted-foreground">Rating</div>
                </div>
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-sm font-medium">{profile.location}</div>
                  <div className="text-sm text-muted-foreground">Location</div>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h2 className="font-semibold mb-2">About</h2>
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="listings" className="w-full">
        <TabsList>
          <TabsTrigger value="listings">Active Listings</TabsTrigger>
          <TabsTrigger value="sold">Sold Items</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="listings">
          <div className="mt-6">
            <ListingGrid userId={id as string} />
          </div>
        </TabsContent>
        
        <TabsContent value="sold">
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Sold Items History</h3>
              <p className="text-muted-foreground">No sold items to display.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reviews">
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">User Reviews</h3>
              <p className="text-muted-foreground">No reviews yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}