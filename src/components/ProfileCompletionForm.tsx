import React, { useState } from 'react';
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

export default function ProfileCompletionForm() {
  const { user, profile, updateProfile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (location: string) => {
    setFormData(prev => ({ ...prev, location }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate username
      if (!formData.username || formData.username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }

      // Update profile with completed information
      await updateProfile({
        username: formData.username,
        bio: formData.bio,
        location: formData.location,
        profileCompleted: true
      } as Partial<UserProfile>);

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

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Please provide some additional information to complete your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center mb-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user.photoURL || '/images/default-avatar.svg'} alt="Profile" />
                <AvatarFallback>{formData.username.substring(0, 2).toUpperCase()}</AvatarFallback>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell others about yourself"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <LocationInput
                value={formData.location}
                onChange={handleLocationChange}
                placeholder="Enter your city, state"
              />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
          </form>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Complete Profile'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}