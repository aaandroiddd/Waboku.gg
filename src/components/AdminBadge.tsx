import { Badge } from "@/components/ui/badge"
import { Shield } from "lucide-react"
import { BadgeTooltip } from "@/components/BadgeTooltip"

export const AdminBadge = () => {
  return (
    <BadgeTooltip content="This user is a Waboku.gg administrator with moderation privileges">
      <Badge variant="secondary" className="gap-1 inline-flex items-center">
        <Shield className="h-3 w-3 flex-shrink-0" />
        <span>Admin</span>
      </Badge>
    </BadgeTooltip>
  )
}