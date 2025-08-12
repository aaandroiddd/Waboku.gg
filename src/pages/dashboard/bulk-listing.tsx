import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2, Upload, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { GameCategories } from '@/components/GameCategories';

interface BulkListingItem {
  id: string;
  title: string;
  description: string;
  price: string;
  quantity: string;
  condition: string;
  game: string;
  images: File[];
  imageUrls: string[];
}

export default function BulkListingPage() {
  const { user } = useAuth();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<BulkListingItem[]>([
    {
      id: uuidv4(),
      title: '',
      description: '',
      price: '',
      quantity: '1',
      condition: 'Near Mint',
      game: '',
      images: [],
      imageUrls: []
    }
  ]);

  useEffect(() => {
    if (!premiumLoading && !isPremium) {
      toast.error('Bulk listing is only available for premium users');
      router.push('/dashboard/create-listing');
    }
  }, [isPremium, premiumLoading, router]);

  const addItem = () => {
    setItems([...items, {
      id: uuidv4(),
      title: '',
      description: '',
      price: '',
      quantity: '1',
      condition: 'Near Mint',
      game: '',
      images: [],
      imageUrls: []
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof BulkListingItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleImageUpload = (id: string, files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const maxImages = 10;
    
    if (fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed per listing`);
      return;
    }

    updateItem(id, 'images', fileArray);
  };

  const uploadImages = async (images: File[]): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      const imageRef = ref(storage, `listings/${uuidv4()}-${image.name}`);
      await uploadBytes(imageRef, image);
      return getDownloadURL(imageRef);
    });

    return Promise.all(uploadPromises);
  };

  const validateItem = (item: BulkListingItem): boolean => {
    if (!item.title.trim()) {
      toast.error('All items must have a title');
      return false;
    }
    if (!item.price || parseFloat(item.price) <= 0) {
      toast.error('All items must have a valid price');
      return false;
    }
    if (!item.game) {
      toast.error('All items must have a game selected');
      return false;
    }
    if (item.images.length === 0) {
      toast.error('All items must have at least one image');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate all items
    for (const item of items) {
      if (!validateItem(item)) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const listingPromises = items.map(async (item) => {
        // Upload images
        const imageUrls = await uploadImages(item.images);

        // Create listing document
        const listingData = {
          title: item.title.trim(),
          description: item.description.trim(),
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity),
          condition: item.condition,
          game: item.game,
          images: imageUrls,
          sellerId: user.uid,
          sellerUsername: user.displayName || 'Unknown User',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          views: 0,
          favorites: 0,
          location: '', // You might want to add location handling
          shipping: {
            cost: 0,
            method: 'standard'
          }
        };

        return addDoc(collection(db, 'listings'), listingData);
      });

      await Promise.all(listingPromises);

      toast.success(`Successfully created ${items.length} listings!`);
      router.push('/dashboard/listings');
    } catch (error) {
      console.error('Error creating bulk listings:', error);
      toast.error('Failed to create listings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (premiumLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isPremium) {
    return null; // Will redirect in useEffect
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bulk Listing</h1>
            <p className="text-muted-foreground">Create multiple listings at once</p>
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Premium Feature
          </Badge>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Bulk Listing Instructions:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Fill out all required fields for each item</li>
              <li>• Upload at least one image per item (max 10 images each)</li>
              <li>• All items will be created as active listings</li>
              <li>• Review each item carefully before submitting</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {items.map((item, index) => (
            <Card key={item.id} className="relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg">Item #{index + 1}</CardTitle>
                  <CardDescription>Fill out the details for this listing</CardDescription>
                </div>
                {items.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${item.id}`}>Title *</Label>
                    <Input
                      id={`title-${item.id}`}
                      value={item.title}
                      onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                      placeholder="Enter item title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`price-${item.id}`}>Price *</Label>
                    <Input
                      id={`price-${item.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                    <Input
                      id={`quantity-${item.id}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`condition-${item.id}`}>Condition</Label>
                    <Select value={item.condition} onValueChange={(value) => updateItem(item.id, 'condition', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mint">Mint</SelectItem>
                        <SelectItem value="Near Mint">Near Mint</SelectItem>
                        <SelectItem value="Lightly Played">Lightly Played</SelectItem>
                        <SelectItem value="Moderately Played">Moderately Played</SelectItem>
                        <SelectItem value="Heavily Played">Heavily Played</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`game-${item.id}`}>Game *</Label>
                    <GameCategories
                      value={item.game}
                      onChange={(value) => updateItem(item.id, 'game', value)}
                      placeholder="Select game"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${item.id}`}>Description</Label>
                  <Textarea
                    id={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Describe the item condition, rarity, etc."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`images-${item.id}`}>Images * (Max 10)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id={`images-${item.id}`}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleImageUpload(item.id, e.target.files)}
                      className="flex-1"
                    />
                    <div className="text-sm text-muted-foreground">
                      {item.images.length} selected
                    </div>
                  </div>
                  {item.images.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Selected: {item.images.map(img => img.name).join(', ')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={addItem}
            disabled={isSubmitting}
          >
            Add Another Item
          </Button>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/create-listing')}
              disabled={isSubmitting}
            >
              Switch to Single Listing
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </div>
              ) : (
                `Create ${items.length} Listing${items.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}