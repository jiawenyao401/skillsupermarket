import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild, children, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    }[variant];

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-9 px-4 py-2",
      lg: "h-10 px-6",
    }[size];

    const classes = cn(
      "inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      "min-h-9",
      variants,
      sizes,
      className
    );

    // 简单实现 asChild: 克隆子元素并合并 className
    if (asChild && children) {
      const child = children as React.ReactElement<{ className?: string }>;
      return (
        <child.type
          {...child.props}
          className={cn(classes, child.props.className)}
          ref={ref}
        />
      );
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
