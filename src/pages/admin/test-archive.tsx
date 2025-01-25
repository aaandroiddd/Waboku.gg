import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useState } from "react"

export default function TestArchive() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleTest = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/listings/archive-expired', {
        method: 'POST',
      })
      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">Test Archive Expired Listings</h1>
        <Button 
          onClick={handleTest}
          disabled={loading}
        >
          {loading ? "Processing..." : "Run Archive Test"}
        </Button>
        {result && (
          <pre className="mt-4 p-4 bg-secondary rounded-lg overflow-auto">
            {result}
          </pre>
        )}
      </Card>
    </div>
  )
}