import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-accent text-white shadow-[0_0_15px_var(--color-accent)] border border-accent/50 hover:bg-accent-hover hover:scale-[1.02]": variant === "default",
            "border border-white/10 bg-black/20 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 text-slate-100":
              variant === "outline",
            "hover:bg-white/5 text-slate-300 hover:text-white": variant === "ghost",
            "text-accent underline-offset-4 hover:underline":
              variant === "link",
            "bg-danger text-white hover:bg-danger/90 shadow-[0_0_15px_rgba(239,68,68,0.3)]": variant === "destructive",
            "h-10 px-5 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
