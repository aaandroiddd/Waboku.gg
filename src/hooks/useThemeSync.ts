import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

export function useThemeSync() {
  const { profile } = useAuth();
  const { setTheme, theme, resolvedTheme } = useTheme();

  useEffect(() => {
    // Set theme from profile when profile is loaded and theme exists
    if (profile?.theme) {
      setTheme(profile.theme);
    } else if (!theme && resolvedTheme) {
      // If no profile theme, use system theme as default
      setTheme('system');
    }
  }, [profile, setTheme, theme, resolvedTheme]);

  return null;
}