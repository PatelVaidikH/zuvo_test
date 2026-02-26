import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // BASE STYLES: Clean, crisp, with a smooth 200ms transition
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // DEFAULT: Uses your Sage Green (--primary) and White text. Subtle shadow.
        default:
          "bg-primary text-primary-foreground shadow-sm hover:opacity-90",

        // DESTRUCTIVE: Uses your Terracotta (--destructive).
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",

        // OUTLINE: Uses the stone border and paper background. Great for secondary actions.
        outline:
          "border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground",

        // SECONDARY: Uses the stone/sidebar color.
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        // GHOST: Invisible until hovered. Perfect for the 'Cancel' buttons.
        ghost: "hover:bg-accent hover:text-accent-foreground",

        // LINK: Just text that underlines on hover.
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
