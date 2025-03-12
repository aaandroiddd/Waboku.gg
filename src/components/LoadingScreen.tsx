import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { LoadingAnimation } from "./LoadingAnimation"

export function LoadingScreen({ isLoading, message = "Loading Waboku.gg..." }: { isLoading: boolean, message?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setVisible(true)
    } else {
      // Add a small delay before hiding to allow for fade-out animation
      const timer = setTimeout(() => {
        setVisible(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm transition-opacity duration-500",
        isLoading ? "opacity-100" : "opacity-0"
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