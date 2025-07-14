import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic'
import { LocationInput } from '@/components/LocationInput';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Mail, Bell, Shield, Settings, Trash2, User, Palette, Ban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ClearBrowserDataButton } from '@/components/ClearBrowserDataButton';
import { AccountLinkingButton } from '@/components/AccountLinkingButton';
import { AdvancedTools } from '@/components/dashboard/AdvancedTools';
import { Toaster } from '@/components/ui/toaster';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import MfaEnrollment from '@/components/MfaEnrollment';
import { BlockedUsersManager } from '@/components/BlockedUsersManager';
import { NotificationPreferences } from '@/types/notification';

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
  
  // Collapsible states for different sections
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
  const [isTroubleshootingOpen, setIsTroubleshootingOpen] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  
  // Notification preferences state
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    userId: '',
    email: {
      sales: true,
      messages: true,
      offers: true,
      orderUpdates: true,
      listingUpdates: true,
      marketing: false,
      system: true,
    },
    push: {
      sales: true,
      messages: true,
      offers: true,
      orderUpdates: true,
      listingUpdates: true,
      system: true,
    },
    updatedAt: new Date()
  });
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  
  const { user, profile, updateProfile, deleteAccount } = useAuth();
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

  // Load notification preferences
  const loadNotificationPreferences = async () => {
    if (!user?.uid) return;
    
    setIsLoadingPreferences(true);
    try {
      const preferencesDoc = await getDoc(doc(db, 'notificationPreferences', user.uid));
      if (preferencesDoc.exists()) {
        const data = preferencesDoc.data() as NotificationPreferences;
        setNotificationPreferences(data);
      } else {
        // Create default preferences
        const defaultPreferences: NotificationPreferences = {
          userId: user.uid,
          email: {
            sales: true,
            messages: true,
            offers: true,
            orderUpdates: true,
            listingUpdates: true,
            marketing: false,
            system: true,
          },
          push: {
            sales: true,
            messages: true,
            offers: true,
            orderUpdates: true,
            listingUpdates: true,
            system: true,
          },
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'notificationPreferences', user.uid), defaultPreferences);
        setNotificationPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setIsLoadingPreferences(false);
    }
  };

  // Save notification preferences
  const saveNotificationPreferences = async (newPreferences: NotificationPreferences) => {
    if (!user?.uid) return;
    
    try {
      const updatedPreferences = {
        ...newPreferences,
        userId: user.uid,
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, 'notificationPreferences', user.uid), updatedPreferences);
      setNotificationPreferences(updatedPreferences);
      setSuccess("Notification preferences updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setError("Failed to save notification preferences");
      setTimeout(() => setError(""), 5000);
    }
  };

  // Theme handling function
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'midnight' | 'system') => {
    try {
      setTheme(newTheme);
      
      // Save to cookie for persistence across sessions
      if (typeof window !== 'undefined') {
        document.cookie = `theme=${newTheme}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      }
      
      // Update profile in Firestore (without page reload)
      if (user && profile) {
        const updatedProfile = {
          ...profile,
          theme: newTheme,
          lastUpdated: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      }
      
      setSuccess("Theme updated successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error('Failed to update theme:', err);
      setError("Failed to update theme preference");
      
      // Clear error message after 5 seconds
      setTimeout(() => setError(""), 5000);
    }
  };

  // Get theme display name
  const getThemeDisplayName = (themeValue: string | undefined) => {
    switch (themeValue) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'midnight':
        return 'Midnight';
      case 'system':
        return 'System';
      default:
        return 'Theme';
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmation.toLowerCase() !== 'delete') {
      return;
    }

    setIsDeletingAccount(true);
    setError("");
    
    try {
      await deleteAccount();
      router.push('/');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message || 'Failed to delete account. Please try again.');
      setShowDeleteDialog(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

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
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc && userDoc.exists()) {
          const userData = userDoc.data();
          setFormData({
            username: user.displayName || "",
            bio: userData.bio || "",
            contact: userData.contact || "",
            location: userData.location || "",
            youtube: userData.social?.youtube || "",
            twitter: userData.social?.twitter || "",
            facebook: userData.social?.facebook || "",
            locationData: {
              city: userData.locationData?.city || "",
              state: userData.locationData?.state || ""
            }
          });

          if (userData.theme) {
            setTheme(userData.theme);
          }
          
          if (user.photoURL) {
            setAvatarPreview(user.photoURL);
          }
        }
        
        // Load notification preferences
        await loadNotificationPreferences();
      } catch (err: any) {
        console.error('Error loading user data:', err);
        setError("Failed to load user data");
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
    
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const fileExtension = mimeToExt[file.type] || 'jpg';
    const fileName = `avatars/${user!.uid}/profile.${fileExtension}`;
    const storageRef = ref(storage, fileName);
    
    const metadata = {
      contentType: file.type,
      customMetadata: {
        owner: user!.uid,
        uploadedAt: new Date().toISOString()
      }
    };
    
    const snapshot = await uploadBytes(storageRef, file, metadata);
    return await getDownloadURL(snapshot.ref);
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
        photoURL = await uploadAvatar(avatarFile);
      }

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
      <Toaster />

      <div className="container mx-auto p-6 space-y-6">
        {/* Main Profile Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-6 w-6" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Manage your profile information and public display
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
                  {avatarPreview ? (
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={avatarPreview} />
                      <AvatarFallback>
                        {formData.username && formData.username.length > 0 
                          ? formData.username.slice(0, 2).toUpperCase() 
                          : user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <ProfileAvatar user={user} size="xl" className="w-24 h-24" />
                  )}
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

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating Profile...
                  </div>
                ) : (
                  "Save Profile Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <Collapsible open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    <div>
                      <CardTitle>Email Notifications</CardTitle>
                      <CardDescription>
                        Control which email notifications you receive
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {isLoadingPreferences ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sales Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when someone purchases your items
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.sales}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, sales: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Message Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when you receive new messages
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.messages}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, messages: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Offer Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified about offers on your listings
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.offers}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, offers: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Order Updates</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified about shipping and order status changes
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.orderUpdates}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, orderUpdates: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Listing Updates</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when your listings expire or need attention
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.listingUpdates}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, listingUpdates: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>System Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified about important system updates and security alerts
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.system}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, system: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Marketing Emails</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive promotional emails and platform updates
                          </p>
                        </div>
                        <Switch
                          checked={notificationPreferences.email.marketing}
                          onCheckedChange={(checked) => {
                            const newPreferences = {
                              ...notificationPreferences,
                              email: { ...notificationPreferences.email, marketing: checked }
                            };
                            saveNotificationPreferences(newPreferences);
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <Collapsible open={isAppearanceOpen} onOpenChange={setIsAppearanceOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    <div>
                      <CardTitle>Appearance & Contact</CardTitle>
                      <CardDescription>
                        Customize your theme and contact information
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Theme Section */}
                <div className="space-y-4">
                  <div>
                    <Label>Theme Preference</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred theme for the application
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 border hover:bg-accent hover:text-accent-foreground transition-colors ${
                        theme === 'light' ? 'bg-accent text-accent-foreground border-primary' : 'text-muted-foreground'
                      }`}
                    >
                      ☀️ Light
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 border hover:bg-accent hover:text-accent-foreground transition-colors ${
                        theme === 'dark' ? 'bg-accent text-accent-foreground border-primary' : 'text-muted-foreground'
                      }`}
                    >
                      🌙 Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('midnight')}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 border hover:bg-accent hover:text-accent-foreground transition-colors ${
                        theme === 'midnight' ? 'bg-accent text-accent-foreground border-primary' : 'text-muted-foreground'
                      }`}
                    >
                      🌌 Midnight
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 border hover:bg-accent hover:text-accent-foreground transition-colors ${
                        theme === 'system' ? 'bg-accent text-accent-foreground border-primary' : 'text-muted-foreground'
                      }`}
                    >
                      💻 System
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
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
                      Help others find local trades
                    </p>
                  </div>

                  {/* Social Media Links */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Social Media Links</h4>
                    
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
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Security Settings */}
        <Card>
          <Collapsible open={isSecurityOpen} onOpenChange={setIsSecurityOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <div>
                      <CardTitle>Security</CardTitle>
                      <CardDescription>
                        Enhance your account security
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add an extra layer of security to your account by enabling two-factor authentication.
                    </p>
                    <MfaEnrollment />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Blocked Users */}
        <Card>
          <Collapsible open={isBlockedUsersOpen} onOpenChange={setIsBlockedUsersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5" />
                    <div>
                      <CardTitle>Blocked Users</CardTitle>
                      <CardDescription>
                        Manage users you have blocked from messaging you
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <BlockedUsersManager />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <Collapsible open={isTroubleshootingOpen} onOpenChange={setIsTroubleshootingOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <div>
                      <CardTitle>Troubleshooting</CardTitle>
                      <CardDescription>
                        Tools to help resolve common issues
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Dashboard Diagnostics</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Advanced tools to help diagnose and resolve dashboard listing visibility issues.
                    </p>
                    <AdvancedTools />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Fix Browser Data</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      If you're experiencing login issues or other unexpected behavior, clearing your browser's authentication data may help.
                    </p>
                    <ClearBrowserDataButton variant="outline" size="default" className="w-full sm:w-auto" />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Link Accounts</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      If you've signed up with both email and Google using the same email address, you can link these accounts.
                    </p>
                    <AccountLinkingButton />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <Collapsible open={isDangerZoneOpen} onOpenChange={setIsDangerZoneOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-red-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    <div>
                      <CardTitle className="text-red-600">Danger Zone</CardTitle>
                      <CardDescription>
                        Irreversible and destructive actions
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Collapsible>
        </Card>

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
                    <p className="font-medium">Type "delete" to confirm:</p>
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
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(SettingsPageContent), {
  ssr: false
});