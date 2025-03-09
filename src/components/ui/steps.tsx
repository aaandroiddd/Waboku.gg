import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

export interface StepsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Steps({ className, children, ...props }: StepsProps) {
  const childrenArray = React.Children.toArray(children);
  const steps = childrenArray.map((step, index) => {
    if (React.isValidElement(step)) {
      return React.cloneElement(step, {
        stepNumber: index + 1,
        totalSteps: childrenArray.length,
      });
    }
    return step;
  });

  return (
    <div
      className={cn("flex flex-col space-y-4", className)}
      {...props}
    >
      {steps}
    </div>
  );
}

export interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  status?: "upcoming" | "current" | "complete";
  stepNumber?: number;
  totalSteps?: number;
}

export function Step({
  title,
  description,
  status = "upcoming",
  stepNumber,
  totalSteps,
  className,
  ...props
}: StepProps) {
  return (
    <div
      className={cn(
        "flex items-start",
        className
      )}
      {...props}
    >
      <div className="flex-shrink-0 mr-4">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border-2",
            status === "upcoming" && "border-gray-300 text-gray-400",
            status === "current" && "border-primary text-primary",
            status === "complete" && "border-green-500 bg-green-500 text-white"
          )}
        >
          {status === "complete" ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <span className="text-sm font-medium">{stepNumber}</span>
          )}
        </div>
        {stepNumber !== totalSteps && (
          <div
            className={cn(
              "w-0.5 h-10 ml-4 -mt-1",
              status === "upcoming" && "bg-gray-200",
              status === "current" && "bg-gray-300",
              status === "complete" && "bg-green-500"
            )}
          />
        )}
      </div>
      <div className="pt-1 pb-8">
        <h3
          className={cn(
            "text-base font-medium",
            status === "upcoming" && "text-gray-500",
            status === "current" && "text-primary",
            status === "complete" && "text-green-600"
          )}
        >
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              "mt-1 text-sm",
              status === "upcoming" && "text-gray-400",
              status === "current" && "text-gray-600",
              status === "complete" && "text-gray-600"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}