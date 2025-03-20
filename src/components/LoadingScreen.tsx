import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { LoadingAnimation } from "./LoadingAnimation"

export function LoadingScreen({ isLoading, message = "Loading Waboku.gg..." }: { isLoading: boolean, message?: string }) {
  const [visible, setVisible] = useState(false)
  const [loadingTimerId, setLoadingTimerId] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only show loading screen if loading persists for more than 200ms
    // This prevents flashing for quick loads
    if (isLoading) {
      // Clear any existing timer
      if (loadingTimerId) {
        clearTimeout(loadingTimerId)
      }
      
      // Set a new timer to show loading screen after delay
      const timerId = setTimeout(() => {
        setVisible(true)
      }, 200) // Reduced from 300ms to 200ms for faster feedback
      
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
      
      // Add a small delay before hiding to allow for fade-out animation
      const timer = setTimeout(() => {
        setVisible(false)
      }, 300) // Reduced from 500ms to 300ms for faster transitions
      
      return () => clearTimeout(timer)
    }
  }, [isLoading, loadingTimerId])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm transition-opacity duration-300",
        visible && isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
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