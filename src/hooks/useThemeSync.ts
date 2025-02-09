import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

export function useThemeSync() {
  const { profile } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme);
    } else {
      // If no theme preference is set in profile, default to system
      setTheme('system');
    }
  }, [profile, setTheme]);

  return null;
}