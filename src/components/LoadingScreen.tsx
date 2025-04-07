import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { LoadingAnimation } from "./LoadingAnimation"
import { Progress } from "@/components/ui/progress"

export function LoadingScreen({ isLoading, message = "Loading..." }: { isLoading: boolean, message?: string }) {
  const [visible, setVisible] = useState(false)
  const [loadingTimerId, setLoadingTimerId] = useState<NodeJS.Timeout | null>(null)
  const [progress, setProgress] = useState(0)

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
        // Start progress animation
        setProgress(10)
        setTimeout(() => setProgress(30), 200)
        setTimeout(() => setProgress(60), 600)
        setTimeout(() => setProgress(80), 1200)
      }, 100)
      
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
      
      // Complete the progress bar before hiding
      setProgress(100)
      
      // Add a small delay before hiding to show the completed progress
      setTimeout(() => {
        setVisible(false)
      }, 200)
      
      return () => {}
    }
  }, [isLoading, loadingTimerId])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300",
        visible && isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!visible || !isLoading}
      role="status"
    >
      <div className="flex flex-col items-center justify-center space-y-6 max-w-md w-full px-4">
        <LoadingAnimation color="var(--theme-primary, #000)" />
        
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-1 w-full" />
          <p className="text-center text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}