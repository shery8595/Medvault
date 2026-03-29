import * as React from "react";
import { cn } from "../../lib/utils";

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: number,
    variant?: "default" | "success" | "warning" | "destructive"
  }
>(({ className, value, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "h-full w-full flex-1 transition-all",
        variant === "default" && "bg-accent",
        variant === "success" && "bg-blue-500",
        variant === "warning" && "bg-amber-500",
        variant === "destructive" && "bg-rose-500"
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };
