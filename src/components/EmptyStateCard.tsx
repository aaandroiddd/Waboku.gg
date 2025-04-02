import { Card } from "@/components/ui/card";

interface EmptyStateCardProps {
  title: string;
  description: string;
  actionText?: string;
}

export function EmptyStateCard({ title, description, actionText }: EmptyStateCardProps) {
  return (
    <Card className="p-6 text-center">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">
        {description}
      </p>
      {actionText && (
        <p className="text-sm text-muted-foreground">
          {actionText}
        </p>
      )}
    </Card>
  );
}