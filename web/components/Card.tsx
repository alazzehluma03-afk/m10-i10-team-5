import { HTMLAttributes } from "react";

type CardVariant = "default" | "highlight" | "error";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default:
    "bg-cream dark:bg-charcoal-light border border-warm-gray/20 shadow-sm hover:shadow-md dark:border-warm-gray-dark/30",
  highlight:
    "bg-gradient-to-br from-sage/5 to-saffron/10 border border-saffron/30 shadow-md hover:shadow-lg dark:from-sage-dark/20 dark:to-saffron-dark/20 dark:border-saffron/20",
  error:
    "bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700/50",
};

export function Card({
  variant = "default",
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-xl p-6 transition-all duration-200",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
