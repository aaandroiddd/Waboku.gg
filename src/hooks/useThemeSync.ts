import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

export function useThemeSync() {
  const { profile } = useAuth();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Only set theme from profile on initial load when theme is not yet set
    if (profile?.theme && !theme) {
      setTheme(profile.theme);
    }
  }, [profile, setTheme, theme]);

  return null;
}