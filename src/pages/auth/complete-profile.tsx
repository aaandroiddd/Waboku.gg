import { useEffect } from 'react';
import ProfileInitializer from '@/components/ProfileInitializer';

export default function CompleteProfilePage() {
  useEffect(() => {
    // Log when the complete-profile page is loaded
    console.log('Complete profile page loaded');
    
    // Check if needs_profile_completion flag is set
    if (typeof window !== 'undefined') {
      const needsCompletion = localStorage.getItem('needs_profile_completion');
      console.log('needs_profile_completion flag:', needsCompletion);
    }
  }, []);
  
  return <ProfileInitializer />;
}