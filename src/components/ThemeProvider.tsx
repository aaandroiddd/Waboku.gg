import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

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

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Get initial theme from cookie or default to system
  const cookieTheme = getThemeFromCookie();
  const defaultTheme = cookieTheme || "system";

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
      forcedTheme={props.forcedTheme}
      themes={['light', 'dark', 'midnight', 'system']}
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}