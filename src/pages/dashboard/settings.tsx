import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic'
import { LocationInput } from '@/components/LocationInput';
import { AccountFeatures } from '@/components/AccountFeatures';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from 'next/router';
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout').then(mod => mod.DashboardLayout),
  {
    loading: () => (
      <div className="p-8">
        <Skeleton className="w-full h-[200px]" />
      </div>
    ),
    ssr: false
  }
);

const SettingsPageContent = () => {
  const { theme, setTheme } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmation.toLowerCase() !== 'delete') {
      return;
    }

    setIsDeletingAccount(true);
    try {
      // Delete all user's listings - try both userId and uid fields
      const listingsRef = collection(db, 'listings');
      const qUserId = query(listingsRef, where('userId', '==', user.uid));
      const qUid = query(listingsRef, where('uid', '==', user.uid));
      
      // Get listings with userId
      const querySnapshotUserId = await getDocs(qUserId);
      const deletePromisesUserId = querySnapshotUserId.docs.map(doc => deleteDoc(doc.ref));
      
      // Get listings with uid
      const querySnapshotUid = await getDocs(qUid);
      const deletePromisesUid = querySnapshotUid.docs.map(doc => deleteDoc(doc.ref));
      
      // Execute all deletions
      await Promise.all([...deletePromisesUserId, ...deletePromisesUid]);

      console.log(`Deleted ${querySnapshotUserId.size + querySnapshotUid.size} listings`);

      // Delete user profile
      await deleteDoc(doc(db, 'users', user.uid));

      // Delete user authentication
      await user.delete();

      // Redirect to home page
      router.push('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setError('Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
    }
  };
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    username: user?.displayName || "",
    bio: "",
    contact: "",
    location: "",
    youtube: "",
    twitter: "",
    facebook: "",
    locationData: {
      city: "",
      state: ""
    }
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.photoURL || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Load user data when component mounts
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.uid) {
        router.push('/auth/sign-in');
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        
        // First check if user auth is still valid
        await user.reload();
        
        // Add a small delay to ensure Firebase auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Double check if user is still authenticated after reload
        if (!auth.currentUser) {
          throw new Error('auth/user-not-authenticated');
        }
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFormData({
            username: user.displayName || "",
            bio: userData.bio || "",
            contact: userData.contact || "",
            location: userData.location || "",
            youtube: userData.social?.youtube || "",
            twitter: userData.social?.twitter || "",
            facebook: userData.social?.facebook || "",
          });

          // Set theme from user preferences if it exists
          if (userData.theme) {
            setTheme(userData.theme);
          }
        } else {
          console.log('Creating new user profile for:', user.uid);
          // If no user document exists, create one with basic data
          const basicProfile = {
            uid: user.uid,
            email: user.email,
            username: user.displayName || user.email?.split('@')[0] || "",
            joinDate: new Date().toISOString(),
            bio: "",
            contact: "",
            location: "",
            social: {
              youtube: "",
              twitter: "",
              facebook: ""
            }
          };
          
          await setDoc(doc(db, 'users', user.uid), basicProfile);
          
          setFormData({
            username: user.displayName || "",
            bio: "",
            contact: "",
            location: "",
            youtube: "",
            twitter: "",
            facebook: "",
          });
        }
      } catch (err: any) {
        console.error('Error loading user data:', err);
        
        // More specific error messages based on the error type
        if (err.message === 'auth/user-not-authenticated') {
          setError("Your session has expired. Please sign in again.");
          router.push('/auth/sign-in');
          return;
        }
        
        if (err.code === 'permission-denied') {
          setError("You don't have permission to access this data. Please sign in again.");
          router.push('/auth/sign-in');
        } else if (err.code === 'not-found') {
          setError("Your profile data could not be found. Please try signing out and back in.");
          router.push('/auth/sign-in');
        } else if (err.name === 'FirebaseError') {
          switch (err.code) {
            case 'auth/network-request-failed':
              setError("Network error. Please check your internet connection and try again.");
              break;
            case 'auth/user-token-expired':
            case 'auth/user-not-found':
            case 'auth/invalid-user-token':
              setError("Your session has expired. Please sign in again.");
              router.push('/auth/sign-in');
              break;
            default:
              console.error('Unhandled Firebase error:', err);
              setError("An error occurred while loading your profile. Please try signing out and back in.");
          }
        } else {
          console.error('Unknown error:', err);
          setError("Failed to load user data. Please try refreshing the page or sign in again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user?.uid, setTheme, router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Image size should be less than 5MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError("Please upload an image file");
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const storage = getStorage();
    
    // Get file extension from mime type
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const fileExtension = mimeToExt[file.type] || 'jpg';
    const fileName = `avatars/${user!.uid}/profile.${fileExtension}`;
    const storageRef = ref(storage, fileName);
    
    // Add metadata to indicate file ownership
    const metadata = {
      contentType: file.type,
      customMetadata: {
        owner: user!.uid,
        uploadedAt: new Date().toISOString()
      }
    };
    
    try {
      console.log('Uploading avatar:', {
        fileName,
        contentType: file.type,
        size: file.size,
        userId: user!.uid
      });
      
      const snapshot = await uploadBytes(storageRef, file, metadata);
      return await getDownloadURL(snapshot.ref);
    } catch (error: any) {
      console.error('Storage error details:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      // Basic validation
      if (formData.username.length < 3 || formData.username.length > 20) {
        throw new Error("Username must be between 3 and 20 characters");
      }

      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        throw new Error("Username can only contain letters, numbers, and underscores");
      }

      let photoURL = user?.photoURL;
      if (avatarFile) {
        try {
          photoURL = await uploadAvatar(avatarFile);
        } catch (error: any) {
          console.error('Avatar upload error:', error);
          throw new Error("Failed to upload profile picture. Please try again.");
        }
      }

      // Update profile with all user data
      await updateProfile({
        username: formData.username,
        photoURL,
        bio: formData.bio,
        contact: formData.contact,
        location: formData.location,
        theme: theme,
        social: {
          youtube: formData.youtube || '',
          twitter: formData.twitter || '',
          facebook: formData.facebook || ''
        }
      });

      setSuccess("Profile updated successfully!");
      
      // Reset avatar file after successful upload
      setAvatarFile(null);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  return (
    <DashboardLayout>

      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Manage your profile information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 text-green-700 border-green-200">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Avatar Section */}
              <div className="space-y-4">
                <Label>Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarPreview} />
                    <AvatarFallback>{formData.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Recommended: Square image, max 5MB
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Username Section */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Your username"
                />
                <p className="text-xs text-muted-foreground">
                  This is your public display name
                </p>
              </div>

              {/* Bio Section */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text.length <= 1000) {
                      setFormData(prev => ({ ...prev, bio: text }));
                    }
                  }}
                  placeholder="Tell us about yourself (max 1000 characters)"
                  className="min-h-[100px]"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.bio.length}/1000 characters
                </p>
              </div>

              {/* Social Media Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Social Media Links</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube Channel</Label>
                  <Input
                    id="youtube"
                    value={formData.youtube}
                    onChange={(e) => setFormData(prev => ({ ...prev, youtube: e.target.value }))}
                    placeholder="https://youtube.com/@yourchannel"
                    type="url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter">X (Twitter) Profile</Label>
                  <Input
                    id="twitter"
                    value={formData.twitter}
                    onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                    placeholder="https://x.com/yourusername"
                    type="url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook Profile</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => setFormData(prev => ({ ...prev, facebook: e.target.value }))}
                    placeholder="https://facebook.com/yourusername"
                    type="url"
                  />
                </div>
              </div>

              <Separator />

              {/* Contact Section */}
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Information</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="How others can contact you"
                />
                <p className="text-xs text-muted-foreground">
                  This will be visible to other users
                </p>
              </div>

              {/* Location Section */}
              <div className="space-y-2">
                <LocationInput
                  onLocationSelect={(city, state) => {
                    setFormData(prev => ({
                      ...prev,
                      location: `${city}, ${state}`,
                      locationData: {
                        city,
                        state
                      }
                    }));
                  }}
                  initialCity={formData.locationData?.city}
                  initialState={formData.locationData?.state}
                  error={error && error.includes('location') ? error : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Help others find local trades. Search for your city or use the current location option.
                </p>
              </div>

              <Separator />

              {/* Theme Section */}
              <div className="space-y-2">
                <Label htmlFor="theme">Theme Preference</Label>
                <Select
                  value={theme || 'system'}
                  onValueChange={async (value) => {
                    try {
                      setTheme(value);
                      await updateProfile({
                        ...formData,
                        theme: value,
                        social: {
                          youtube: formData.youtube || '',
                          twitter: formData.twitter || '',
                          facebook: formData.facebook || ''
                        }
                      });
                      setSuccess("Theme updated successfully!");
                    } catch (err) {
                      console.error('Failed to update theme:', err);
                      setError("Failed to update theme preference");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your preferred theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred theme for the application
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating Profile...
                  </div>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Section */}
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Delete Account</CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete your account, profile information, and all your listings.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full"
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete your account
                  and remove all of your data from our servers, including:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your profile information</li>
                  <li>All your listings</li>
                  <li>Your saved preferences</li>
                </ul>
                <div className="space-y-2">
                  <p className="font-medium">Type &quot;delete&quot; to confirm:</p>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type 'delete' here"
                    className="max-w-[300px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation.toLowerCase() !== 'delete' || isDeletingAccount}
            >
              {isDeletingAccount ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </div>
              ) : (
                "Delete Account"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(SettingsPageContent), {
  ssr: false
});