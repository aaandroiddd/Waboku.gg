import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateCardProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
}

export function EmptyStateCard({ title, description, actionText, actionHref }: EmptyStateCardProps) {
  return (
    <Card className="p-6 text-center">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">
        {description}
      </p>
      {actionText && actionHref ? (
        <Link href={actionHref} passHref legacyBehavior>
          <Button as="a" variant="outline" className="mt-2">
            {actionText}
          </Button>
        </Link>
      ) : actionText ? (
        <p className="text-sm text-muted-foreground">
          {actionText}
        </p>
      ) : null}
    </Card>
  );
}