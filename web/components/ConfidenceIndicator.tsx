interface ConfidenceIndicatorProps {
  value: number; // 0–1 float from the API
}

function colorClass(value: number): string {
  if (value >= 0.7) return "from-sage to-sage-light";
  if (value >= 0.4) return "from-saffron to-saffron-light";
  return "from-red-500 to-red-400";
}

function label(value: number): string {
  if (value >= 0.7) return "High confidence";
  if (value >= 0.4) return "Moderate confidence";
  return "Low confidence";
}

export function ConfidenceIndicator({ value }: ConfidenceIndicatorProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-warm-gray dark:text-warm-gray-light">
          Confidence
        </span>
        <span className="font-mono font-bold text-charcoal dark:text-cream">
          {pct}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-warm-gray/20 overflow-hidden"
        aria-hidden="true"
      >
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label(value)}: ${pct}%`}
          style={{ width: `${pct}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${colorClass(value)} transition-all duration-500`}
        />
      </div>
      <p className="text-xs text-warm-gray dark:text-warm-gray-light">
        {label(value)} — how well the retrieved passages support this answer.
      </p>
    </div>
  );
}
