import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { LoadingAnimation } from "./LoadingAnimation"

export function LoadingScreen({ isLoading, message = "Loading Waboku.gg..." }: { isLoading: boolean, message?: string }) {
  const [visible, setVisible] = useState(false)
  const [loadingTimerId, setLoadingTimerId] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only show loading screen if loading persists for more than 100ms
    // This prevents flashing for quick loads but shows feedback faster
    if (isLoading) {
      // Clear any existing timer
      if (loadingTimerId) {
        clearTimeout(loadingTimerId)
      }
      
      // Set a new timer to show loading screen after delay
      const timerId = setTimeout(() => {
        setVisible(true)
      }, 100) // Reduced from 200ms to 100ms for faster feedback
      
      setLoadingTimerId(timerId)
      
      return () => {
        if (timerId) clearTimeout(timerId)
      }
    } else {
      // Clear the timer if loading completes before delay
      if (loadingTimerId) {
        clearTimeout(loadingTimerId)
        setLoadingTimerId(null)
      }
      
      // Immediately start fade-out animation
      setVisible(false)
      
      return () => {}
    }
  }, [isLoading, loadingTimerId])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm transition-opacity duration-200",
        visible && isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      // Add aria-hidden to improve accessibility
      aria-hidden={!visible || !isLoading}
      // Add role="status" for screen readers
      role="status"
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <LoadingAnimation color="var(--theme-primary, #000)" />
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      </div>
    </div>
  )
}