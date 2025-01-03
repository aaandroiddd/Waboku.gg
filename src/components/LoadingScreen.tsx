import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"

export function LoadingScreen({ isLoading }: { isLoading: boolean }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      const timer = setInterval(() => {
        setProgress((oldProgress) => {
          if (oldProgress === 100) {
            clearInterval(timer)
            return 100
          }
          const diff = Math.random() * 10
          return Math.min(oldProgress + diff, 95)
        })
      }, 200)

      return () => {
        clearInterval(timer)
      }
    } else {
      setProgress(100)
    }
  }, [isLoading])

  if (!isLoading && progress === 100) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-300",
        isLoading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="w-[70%] max-w-md space-y-4">
        <Progress value={progress} className="h-2 w-full" />
        <p className="text-center text-sm text-muted-foreground">
          Loading Waboku.gg...
        </p>
      </div>
    </div>
  )
}