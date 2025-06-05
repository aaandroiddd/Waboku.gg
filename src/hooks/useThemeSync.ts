import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

// Function to save theme to cookie
function saveThemeToCookie(theme: string) {
  if (typeof window === 'undefined') return;
  
  const validThemes = ['light', 'dark', 'midnight', 'system'];
  if (validThemes.includes(theme)) {
    document.cookie = `theme=${theme}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  }
}

export function useThemeSync() {
  const { profile } = useAuth();
  const { setTheme, theme } = useTheme();

  // Only sync from profile to theme when profile changes and has a valid theme
  useEffect(() => {
    if (profile?.theme && profile.theme !== theme) {
      const validThemes = ['light', 'dark', 'midnight', 'system'];
      if (validThemes.includes(profile.theme)) {
        setTheme(profile.theme);
      }
    }
  }, [profile?.theme, setTheme, theme]);

  // Save theme to cookie whenever it changes
  useEffect(() => {
    if (theme) {
      saveThemeToCookie(theme);
    }
  }, [theme]);

  return null;
}