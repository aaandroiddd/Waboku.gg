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
import { ClearBrowserDataButton } from '@/components/ClearBrowserDataButton';
import { AccountLinkingButton } from '@/components/AccountLinkingButton';
import { Toaster } from '@/components/ui/toaster';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import MfaEnrollment from '@/components/MfaEnrollment';

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
    setError("");
    
    try {
      // Use the deleteAccount method from AuthContext which handles:
      // 1. Subscription cancellation for premium users
      // 2. Reauthentication for Google OAuth users
      // 3. Deletion of all user data (listings, profile, messages, etc.)
      // 4. Proper error handling
      await deleteAccount();
      
      // Redirect to home page on success
      router.push('/');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message || 'Failed to delete account. Please try again.');
      setShowDeleteDialog(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };
  const { user, updateProfile, deleteAccount } = useAuth();
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
    // Import the token manager functions
    const loadTokenManager = async () => {
      const { refreshAuthToken, validateUserSession, storeAuthState } = await import('@/lib/auth-token-manager');
      return { refreshAuthToken, validateUserSession, storeAuthState };
    };

    // Setup periodic token refresh to prevent expiration
    let tokenRefreshInterval: NodeJS.Timeout | null = null;
    
    const setupTokenRefresh = async (userId: string) => {
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
      
      // Store current auth state
      const { storeAuthState } = await loadTokenManager();
      storeAuthState(userId);
      
      // Set up a token refresh every 25 minutes (token expires in 60 minutes)
      tokenRefreshInterval = setInterval(async () => {
        if (auth.currentUser) {
          try {
            const { refreshAuthToken } = await loadTokenManager();
            console.log('Performing scheduled token refresh...');
            await refreshAuthToken(auth.currentUser);
          } catch (refreshError) {
            console.error('Error during scheduled token refresh:', refreshError);
            // Don't show error to user for background refresh failures
            // The next user action will trigger another refresh attempt
          }
        } else {
          // Clear interval if user is no longer authenticated
          if (tokenRefreshInterval) {
            clearInterval(tokenRefreshInterval);
            tokenRefreshInterval = null;
          }
        }
      }, 25 * 60 * 1000); // 25 minutes
    };

    const loadUserData = async (retryCount = 0) => {
      if (!user?.uid) {
        console.log('No user UID found, redirecting to sign-in');
        router.push('/auth/sign-in');
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        
        console.log(`Attempting to load user data (attempt ${retryCount + 1}/5)...`);
        
        // Load token manager functions
        const { refreshAuthToken, validateUserSession } = await loadTokenManager();
        
        // Setup token refresh interval
        await setupTokenRefresh(user.uid);
        
        // Validate user session first
        const isSessionValid = await validateUserSession(user);
        if (!isSessionValid && retryCount < 2) {
          console.log('User session invalid, attempting to refresh...');
          // Try to refresh the token before giving up
          await refreshAuthToken(user);
          
          // Wait a moment and retry
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return loadUserData(retryCount + 1);
        } else if (!isSessionValid) {
          console.error('User session invalid after multiple attempts');
          setError("Your session has expired. Please sign in again.");
          router.push('/auth/sign-in');
          return;
        }
        
        // Get current auth state
        const currentUser = auth.currentUser;
        
        // If user is not authenticated, redirect to sign in
        if (!currentUser) {
          console.error('User not authenticated after validation');
          setError("Your session has expired. Please sign in again.");
          router.push('/auth/sign-in');
          return;
        }
        
        // Get a fresh token before fetching data, but don't force refresh if not needed
        // This helps prevent rate limiting issues with Firebase Auth
        await refreshAuthToken(currentUser);
        
        try {
          console.log('Fetching user document from Firestore...');
          // Try to get user document with retries
          let userDoc = null;
          let fetchError = null;
          
          for (let i = 0; i < 3; i++) {
            try {
              userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              fetchError = null;
              break;
            } catch (error) {
              console.error(`Firestore fetch attempt ${i + 1} failed:`, error);
              fetchError = error;
              
              // Only force token refresh if we get a permission error
              if (error.code === 'permission-denied') {
                await refreshAuthToken(currentUser);
              }
              
              // Add jitter to prevent thundering herd
              const baseDelay = 1000 * Math.pow(2, i);
              const jitter = Math.random() * 500;
              await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
            }
          }
          
          // If all retries failed, throw the last error
          if (fetchError) {
            throw fetchError;
          }
          
          if (userDoc && userDoc.exists()) {
            console.log('User document found in Firestore');
            const userData = userDoc.data();
            setFormData({
              username: currentUser.displayName || "",
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

            // Set theme from user preferences if it exists
            if (userData.theme) {
              setTheme(userData.theme);
            }
            
            // Set avatar preview if available
            if (currentUser.photoURL) {
              setAvatarPreview(currentUser.photoURL);
            }
          } else {
            console.log('No user document found, creating new profile for:', currentUser.uid);
            // If no user document exists, create one with basic data
            const basicProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              username: currentUser.displayName || currentUser.email?.split('@')[0] || "",
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || "",
              joinDate: new Date().toISOString(),
              bio: "",
              contact: "",
              location: "",
              avatarUrl: currentUser.photoURL || "",
              photoURL: currentUser.photoURL || "",
              isEmailVerified: currentUser.emailVerified || false,
              social: {
                youtube: "",
                twitter: "",
                facebook: ""
              },
              accountTier: 'free',
              tier: 'free',
              subscription: {
                status: 'inactive',
                currentPlan: 'free',
                startDate: new Date().toISOString()
              }
            };
            
            // Try to create the user document with retries
            let createSuccess = false;
            for (let i = 0; i < 3; i++) {
              try {
                await setDoc(doc(db, 'users', currentUser.uid), basicProfile);
                createSuccess = true;
                break;
              } catch (error) {
                console.error(`Profile creation attempt ${i + 1} failed:`, error);
                
                // Only force token refresh if we get a permission error
                if (error.code === 'permission-denied') {
                  await refreshAuthToken(currentUser);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
              }
            }
            
            if (!createSuccess) {
              throw new Error('Failed to create user profile after multiple attempts');
            }
            
            setFormData({
              username: currentUser.displayName || "",
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
          }
        } catch (firestoreError: any) {
          console.error('Firestore error:', firestoreError);
          
          // If this is a permission error or not found, we might need to retry
          if (retryCount < 4 && 
              (firestoreError.code === 'permission-denied' || 
               firestoreError.code === 'not-found' ||
               firestoreError.code === 'unavailable' ||
               firestoreError.code === 'resource-exhausted' ||
               firestoreError.code === 'deadline-exceeded')) {
            
            console.log(`Retrying data load after Firestore error (attempt ${retryCount + 1}/5)...`);
            setIsLoading(false);
            
            // Exponential backoff for retries with jitter
            const baseDelay = Math.min(1500 * Math.pow(2, retryCount), 15000);
            const jitter = Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
            
            // Try to get a fresh token before retrying, but only if permission-denied
            if (firestoreError.code === 'permission-denied') {
              await refreshAuthToken(currentUser);
            }
            
            // Retry with incremented count
            return loadUserData(retryCount + 1);
          }
          
          // Handle specific Firestore errors
          if (firestoreError.code === 'permission-denied') {
            setError("You don't have permission to access this data. Please sign in again.");
          } else if (firestoreError.code === 'not-found') {
            setError("Your profile data could not be found. Please try signing out and back in.");
          } else {
            setError(`Database error: ${firestoreError.message || 'Unknown error'}`);
          }
        }
      } catch (err: any) {
        console.error('Error loading user data:', err);
        
        // If we've already retried several times, give up
        if (retryCount >= 4) {
          console.error('Maximum retries reached, giving up');
          // Don't show the error message to the user automatically
          // Instead, we'll silently retry when they interact with the page
          return;
        }
        
        // More specific error messages based on the error type
        if (err.message === 'auth/user-not-authenticated' || 
            err.code === 'auth/user-not-authenticated') {
          // Don't show error or redirect automatically
          console.error('User not authenticated, but not redirecting automatically');
          return;
        }
        
        if (err.code === 'permission-denied') {
          // Don't show error automatically
          console.error('Permission denied, but not showing error automatically');
        } else if (err.code === 'not-found') {
          // Don't show error automatically
          console.error('Profile not found, but not showing error automatically');
        } else if (err.name === 'FirebaseError' || err.code?.startsWith('auth/')) {
          switch (err.code) {
            case 'auth/network-request-failed':
              // Don't show network errors automatically
              console.error('Network error, but not showing error automatically');
              break;
            case 'auth/user-token-expired':
            case 'auth/user-not-found':
            case 'auth/invalid-user-token':
              // Don't redirect automatically
              console.error('Auth token issue, but not redirecting automatically');
              break;
            default:
              console.error('Unhandled Firebase error:', err);
              // Don't show error automatically
          }
        } else {
          console.error('Unknown error:', err);
          
          // For unknown errors, retry after a delay
          console.log(`Retrying data load after unknown error (attempt ${retryCount + 1}/5)...`);
          setIsLoading(false);
          
          // Exponential backoff for retries with jitter
          const baseDelay = Math.min(2000 * Math.pow(2, retryCount), 20000);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
          
          // Retry with incremented count
          return loadUserData(retryCount + 1);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
    
    // Set up a periodic refresh of user data to prevent stale data
    const userDataRefreshInterval = setInterval(() => {
      if (user?.uid) {
        // Silently try to refresh data without showing errors
        loadUserData();
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes
    
    // Clean up intervals on unmount
    return () => {
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
      if (userDataRefreshInterval) {
        clearInterval(userDataRefreshInterval);
      }
    };
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
      // Import token manager for token refresh
      const { refreshAuthToken } = await import('@/lib/auth-token-manager');
      
      // Basic validation
      if (formData.username.length < 3 || formData.username.length > 20) {
        throw new Error("Username must be between 3 and 20 characters");
      }

      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        throw new Error("Username can only contain letters, numbers, and underscores");
      }

      // Refresh token before making any changes
      if (user) {
        await refreshAuthToken(user);
      }

      let photoURL = user?.photoURL;
      if (avatarFile) {
        try {
          photoURL = await uploadAvatar(avatarFile);
        } catch (error: any) {
          console.error('Avatar upload error:', error);
          
          // Try to refresh token and retry upload once
          if (user) {
            try {
              console.log('Refreshing token and retrying avatar upload...');
              await refreshAuthToken(user);
              photoURL = await uploadAvatar(avatarFile);
            } catch (retryError) {
              console.error('Avatar upload retry failed:', retryError);
              throw new Error("Failed to upload profile picture. Please try again.");
            }
          } else {
            throw new Error("Failed to upload profile picture. Please try again.");
          }
        }
      }

      // Check if we have a profile, if not create a basic one first
      if (!profile && user) {
        console.log('No profile found, creating a basic profile before updating');
        try {
          const { db } = await import('@/lib/firebase');
          
          // Create a basic profile with default values
          const basicProfile = {
            uid: user.uid,
            email: user.email,
            username: formData.username,
            displayName: formData.username,
            joinDate: new Date().toISOString(),
            bio: formData.bio || "",
            contact: formData.contact || "",
            location: formData.location || "",
            avatarUrl: photoURL || "",
            photoURL: photoURL || "",
            isEmailVerified: user.emailVerified || false,
            social: {
              youtube: formData.youtube || '',
              twitter: formData.twitter || '',
              facebook: formData.facebook || ''
            },
            accountTier: 'free',
            tier: 'free',
            subscription: {
              status: 'inactive',
              currentPlan: 'free',
              startDate: new Date().toISOString()
            }
          };
          
          await setDoc(doc(db, 'users', user.uid), basicProfile);
          console.log('Basic profile created successfully');
        } catch (createError) {
          console.error('Error creating basic profile:', createError);
          throw new Error("Failed to create profile. Please try refreshing the page.");
        }
      }

      // Update profile with all user data
      try {
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
      } catch (profileError: any) {
        console.error('Profile update error:', profileError);
        
        // If this looks like an auth error, try refreshing token and retrying
        if (profileError.message?.includes('auth') || 
            profileError.code?.includes('auth') || 
            profileError.message?.includes('permission') ||
            profileError.message?.includes('No profile found')) {
          
          if (user) {
            console.log('Refreshing token and retrying profile update...');
            await refreshAuthToken(user);
            
            // Retry the update
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
          } else {
            throw profileError;
          }
        } else {
          throw profileError;
        }
      }

      setSuccess("Profile updated successfully!");
      
      // Reset avatar file after successful upload
      setAvatarFile(null);
      
      // Force reload the page after successful update to ensure fresh data
      window.location.reload();
    } catch (err: any) {
      console.error('Profile update error:', err);
      
      // Provide more specific error messages
      if (err.code === 'storage/unauthorized' || err.message?.includes('permission')) {
        setError("You don't have permission to update your profile. Please try signing out and back in.");
      } else if (err.code === 'auth/requires-recent-login' || err.message?.includes('recent')) {
        setError("For security reasons, please sign out and sign back in to update your profile.");
      } else if (err.code?.includes('network') || err.message?.includes('network')) {
        setError("Network error. Please check your internet connection and try again.");
      } else if (err.message?.includes('No profile found')) {
        setError("Profile not found. Please refresh the page to create your profile.");
      } else {
        setError(err.message || "An unexpected error occurred. Please try again.");
      }
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

      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">Profile Settings</CardTitle>
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
                    <SelectItem value="midnight">Midnight</SelectItem>
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

      {/* Security Section */}
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Enhance your account security with additional verification methods
            </CardDescription>
          </CardHeader>
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
        </Card>
      </div>

      {/* Troubleshooting Section */}
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Tools to help resolve common issues with your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Fix Browser Data</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  If you're experiencing login issues or other unexpected behavior, clearing your browser's authentication data may help. This will sign you out and clear any cached authentication information.
                </p>
                <ClearBrowserDataButton variant="outline" size="default" className="w-full sm:w-auto" />
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Link Accounts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  If you've signed up with both email and Google using the same email address, you can link these accounts to ensure your profile data is consistent.
                </p>
                <div className="flex items-center gap-2">
                  <AccountLinkingButton />
                </div>
              </div>
            </div>
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