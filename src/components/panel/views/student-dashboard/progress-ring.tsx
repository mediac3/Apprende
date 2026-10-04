"use client";

// [F1] Aro de progreso SVG puro (Bloque A) — sin dependencias, accesible
import { cn } from "@/lib/utils";

export function progressColor(value: number): string {
  if (value >= 80) return "#10b981"; // emerald-500
  if (value >= 60) return "#0ea5e9"; // sky-500
  if (value >= 40) return "#f59e0b"; // amber-500
  return "#f43f5e"; // rose-500
}

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  size = 150,
  stroke = 12,
  label = "Progreso",
  className,
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = progressColor(clamped);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`${label}: ${clamped}%`}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
