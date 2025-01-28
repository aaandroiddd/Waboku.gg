import { Badge } from "@/components/ui/badge"
import { Shield } from "lucide-react"

export const AdminBadge = () => {
  return (
    <Badge variant="secondary" className="gap-1">
      <Shield className="h-3 w-3" />
      Admin
    </Badge>
  )
}