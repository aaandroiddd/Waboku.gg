import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

// Function to get theme from cookie
function getThemeFromCookie(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const cookies = document.cookie.split(';');
  const themeCookie = cookies.find(cookie => cookie.trim().startsWith('theme='));
  
  if (themeCookie) {
    const theme = themeCookie.split('=')[1];
    const validThemes = ['light', 'dark', 'midnight', 'system'];
    return validThemes.includes(theme) ? theme : undefined;
  }
  
  return undefined;
}

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
  const { setTheme, theme, resolvedTheme } = useTheme();

  useEffect(() => {
    // Priority order for theme selection:
    // 1. User profile theme (if logged in and has preference)
    // 2. Cookie theme (persisted across sessions)
    // 3. System theme (default)
    
    const cookieTheme = getThemeFromCookie();
    
    if (profile?.theme) {
      // User is logged in and has a theme preference in their profile
      const validThemes = ['light', 'dark', 'midnight', 'system'];
      if (validThemes.includes(profile.theme)) {
        setTheme(profile.theme);
        // Also save to cookie for consistency
        saveThemeToCookie(profile.theme);
      } else {
        // If profile theme is not valid, use cookie or system theme
        const fallbackTheme = cookieTheme || 'system';
        setTheme(fallbackTheme);
        saveThemeToCookie(fallbackTheme);
      }
    } else if (cookieTheme && !user) {
      // User is not logged in but has a cookie preference
      setTheme(cookieTheme);
    } else if (!theme && resolvedTheme) {
      // No preference found, use system theme as default
      setTheme('system');
      saveThemeToCookie('system');
    }
  }, [profile, setTheme, theme, resolvedTheme, user]);

  // Save theme to cookie whenever it changes
  useEffect(() => {
    if (theme) {
      saveThemeToCookie(theme);
    }
  }, [theme]);

  return null;
}