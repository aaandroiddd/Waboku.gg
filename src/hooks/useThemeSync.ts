import { useEffect, useRef } from 'react';
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
  const { profile, user } = useAuth();
  const { setTheme, theme } = useTheme();
  const hasInitialized = useRef(false);
  const lastProfileTheme = useRef<string | null>(null);

  // Only sync from profile to theme on initial load or when user changes
  useEffect(() => {
    // Only sync if we have a profile with a theme and it's different from current
    if (profile?.theme && profile.theme !== theme) {
      const validThemes = ['light', 'dark', 'midnight', 'system'];
      if (validThemes.includes(profile.theme)) {
        // Only sync if this is the initial load or if the profile theme actually changed
        // (not just a re-render with the same theme)
        if (!hasInitialized.current || lastProfileTheme.current !== profile.theme) {
          console.log('Syncing theme from profile:', profile.theme);
          setTheme(profile.theme);
          lastProfileTheme.current = profile.theme;
          hasInitialized.current = true;
        }
      }
    } else if (!hasInitialized.current && profile) {
      // Mark as initialized even if no theme in profile
      hasInitialized.current = true;
    }
  }, [profile?.theme, profile?.uid, setTheme, theme]);

  // Reset initialization flag when user changes
  useEffect(() => {
    if (user?.uid !== profile?.uid) {
      hasInitialized.current = false;
      lastProfileTheme.current = null;
    }
  }, [user?.uid, profile?.uid]);

  // Save theme to cookie whenever it changes (but don't sync back to profile here)
  useEffect(() => {
    if (theme) {
      saveThemeToCookie(theme);
    }
  }, [theme]);

  return null;
}