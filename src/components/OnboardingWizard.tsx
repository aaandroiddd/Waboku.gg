import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LocationInput } from '@/components/LocationInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfile } from '@/types/database';
import { Progress } from '@/components/ui/progress';
import { useUserProfileSync } from '@/hooks/useUserProfileSync';
import { Check, ArrowRight } from 'lucide-react';

export default function OnboardingWizard() {
  const { user, profile, updateProfile: authUpdateProfile } = useAuth();
  const { syncProfile } = useUserProfileSync();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    avatarUrl: profile?.avatarUrl || user?.photoURL || '',
  });

  // Update form data when profile or user changes
  useEffect(() => {
    if (profile || user) {
      setFormData(prev => ({
        ...prev,
        username: profile?.username || prev.username,
        bio: profile?.bio || prev.bio,
        location: profile?.location || prev.location,
        avatarUrl: profile?.avatarUrl || user?.photoURL || prev.avatarUrl,
      }));
    }
  }, [profile, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (location: string) => {
    setFormData(prev => ({ ...prev, location }));
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (step === 1 && (!formData.username || formData.username.length < 3)) {
      setError('Please enter a valid username (at least 3 characters)');
      return;
    }
    
    setError(null);
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to complete your profile');
      }

      // Validate username
      if (!formData.username || formData.username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }

      // Create a safe username from the input (alphanumeric and underscores only)
      const safeUsername = formData.username.replace(/[^a-zA-Z0-9_]/g, '_');

      // Update profile with completed information
      await authUpdateProfile({
        username: safeUsername,
        displayName: safeUsername,
        bio: formData.bio || '',
        location: formData.location || '',
        avatarUrl: formData.avatarUrl || user.photoURL || '',
        photoURL: formData.avatarUrl || user.photoURL || '',
        profileCompleted: true,
        lastUpdated: new Date().toISOString()
      } as Partial<UserProfile>);

      // Sync profile to Realtime Database for faster access
      if (user.uid) {
        await syncProfile(
          user.uid,
          safeUsername,
          formData.avatarUrl || user.photoURL || null
        );
      }

      // Clear the profile completion flag from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('needs_profile_completion');
      }

      // Redirect to dashboard after successful completion
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Profile completion error:', err);
      setError(err.message || 'Failed to complete profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no user, show nothing
  if (!user) {
    return null;
  }
  
  // If no profile, create a default form data state
  if (!profile && user) {
    // This is a fallback in case ProfileInitializer didn't create a profile
    console.log('No profile found in OnboardingWizard, using default values');
  }

  const progress = (step / 3) * 100;

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Complete Your Profile</CardTitle>
            <div className="text-sm text-muted-foreground">Step {step} of 3</div>
          </div>
          <Progress value={progress} className="h-2" />
          <CardDescription>
            {step === 1 && "Let's start with your username"}
            {step === 2 && "Tell us about yourself"}
            {step === 3 && "Where are you located?"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <div className="flex justify-center mb-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={formData.avatarUrl || '/images/default-avatar.svg'} alt="Profile" />
                    <AvatarFallback>{(formData.username || '').substring(0, 2).toUpperCase() || (user.email || '').substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username (required)</Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Choose a unique username"
                    required
                    minLength={3}
                    maxLength={30}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be your public display name
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell others about yourself"
                  maxLength={500}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Share a bit about yourself, your interests, or what you collect
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <LocationInput
                  value={formData.location}
                  onChange={handleLocationChange}
                  placeholder="Enter your city, state"
                />
                <p className="text-xs text-muted-foreground">
                  This helps connect you with nearby collectors
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button 
              type="button" 
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          ) : (
            <div></div> // Empty div for spacing
          )}
          
          {step < 3 ? (
            <Button 
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : (
                <>
                  Complete <Check className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}