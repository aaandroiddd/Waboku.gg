import { Progress } from "@/components/ui/progress";
import { Check, X } from "lucide-react";

interface PasswordRequirement {
  label: string;
  isMet: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const requirements: PasswordRequirement[] = [
    {
      label: "At least 6 characters",
      isMet: password.length >= 6,
    },
    {
      label: "Contains uppercase letter",
      isMet: /[A-Z]/.test(password),
    },
    {
      label: "Contains lowercase letter",
      isMet: /[a-z]/.test(password),
    },
    {
      label: "Contains number",
      isMet: /[0-9]/.test(password),
    },
  ];

  const metRequirements = requirements.filter((req) => req.isMet).length;
  const strength = (metRequirements / requirements.length) * 100;

  const getStrengthColor = (strength: number) => {
    if (strength <= 25) return "bg-destructive";
    if (strength <= 50) return "bg-orange-500";
    if (strength <= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-3">
      <Progress 
        value={strength} 
        className="h-2 w-full"
        indicatorClassName={getStrengthColor(strength)}
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {requirements.map((requirement, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-sm"
          >
            {requirement.isMet ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            <span className={requirement.isMet ? "text-muted-foreground" : "text-foreground"}>
              {requirement.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}