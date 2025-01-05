import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { validateTextContent } from "@/util/string";
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';

const MAX_DESCRIPTION_LENGTH = 1000;

const EditListingPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    game: '',
  });

  useEffect(() => {
    const fetchListing = async () => {
      if (!id || !user) return;

      try {
        const listingDoc = await getDoc(doc(db, 'listings', id as string));
        if (!listingDoc.exists()) {
          toast({
            title: 'Error',
            description: 'Listing not found',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        const listingData = listingDoc.data() as Listing;
        
        // Check if the current user owns this listing
        if (listingData.userId !== user.uid) {
          toast({
            title: 'Error',
            description: 'You do not have permission to edit this listing',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        setListing(listingData);
        setFormData({
          title: listingData.title,
          description: listingData.description || '',
          price: listingData.price.toString(),
          condition: listingData.condition || '',
          game: listingData.game || '',
        });
      } catch (error) {
        console.error('Error fetching listing:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch listing details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, user, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    try {
      const listingRef = doc(db, 'listings', id as string);
      await updateDoc(listingRef, {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        condition: formData.condition,
        game: formData.game,
        updatedAt: new Date(),
      });

      toast({
        title: 'Success',
        description: 'Listing updated successfully',
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to update listing',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!listing) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Listing not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Edit Listing</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData({ ...formData, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mint">Mint</SelectItem>
                  <SelectItem value="near-mint">Near Mint</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="played">Played</SelectItem>
                  <SelectItem value="heavily-played">Heavily Played</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="game">Game</Label>
              <Select
                value={formData.game}
                onValueChange={(value) => setFormData({ ...formData, game: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dbs">Dragon Ball Super Card Game</SelectItem>
                  <SelectItem value="digimon">Digimon</SelectItem>
                  <SelectItem value="lorcana">Disney Lorcana</SelectItem>
                  <SelectItem value="flesh-and-blood">Flesh and Blood</SelectItem>
                  <SelectItem value="mtg">Magic: The Gathering</SelectItem>
                  <SelectItem value="onepiece">One Piece Card Game</SelectItem>
                  <SelectItem value="pokemon">Pokemon</SelectItem>
                  <SelectItem value="star-wars">Star Wars: Unlimited</SelectItem>
                  <SelectItem value="union-arena">Union Arena</SelectItem>
                  <SelectItem value="universus">Universus</SelectItem>
                  <SelectItem value="vanguard">Vanguard</SelectItem>
                  <SelectItem value="weiss">Weiss Schwarz</SelectItem>
                  <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Save Changes</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default EditListingPage;