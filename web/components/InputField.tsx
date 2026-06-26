import { InputHTMLAttributes, ReactNode } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
}

export function InputField({
  label,
  error,
  helperText,
  icon,
  id,
  className = "",
  ...props
}: InputFieldProps) {
  const inputId = id ?? `field-${String(label ?? "").toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-charcoal dark:text-cream"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined
          }
          className={[
            "w-full rounded-lg border px-4 py-2.5",
            "bg-cream dark:bg-charcoal-light",
            "text-charcoal dark:text-cream",
            "placeholder:text-warm-gray",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-saffron focus:border-transparent",
            error
              ? "border-red-500 dark:border-red-400"
              : "border-warm-gray/50 dark:border-warm-gray-dark",
            icon ? "pl-10" : "",
            className,
          ].join(" ")}
          {...props}
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-warm-gray">
          {helperText}
        </p>
      )}
    </div>
  );
}
