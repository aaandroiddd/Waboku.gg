import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={props.forcedTheme}
      themes={['light', 'dark', 'midnight', 'system']}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}