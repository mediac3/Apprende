import { cn } from "@/lib/utils";

// Barra horizontal de porcentaje (0-100) con valor numérico al final.
// Tailwind puro: alto/ancho consistentes para toda la app.

interface PercentageBarProps {
  value: number;
  color: string;
  showValue?: boolean;
  className?: string;
}

export function PercentageBar({ value, color, showValue = true, className }: PercentageBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`${v}%`}
      >
        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
      {showValue && (
        <span className="text-[10px] tabular-nums text-muted-foreground">{v}%</span>
      )}
    </div>
  );
}
