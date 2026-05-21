import { cn } from "@/lib/utils";
import type { ConfidenceLevel } from "@/lib/ai/types";

const styles: Record<
  ConfidenceLevel,
  { label: string; bg: string; fg: string; ring: string; dot: string }
> = {
  high: {
    label: "Ready to settle",
    bg: "bg-brand-50",
    fg: "text-brand-800",
    ring: "ring-brand-200/80",
    dot: "bg-brand-600",
  },
  medium: {
    label: "Review warnings",
    bg: "bg-amber-50",
    fg: "text-amber-900",
    ring: "ring-amber-200/80",
    dot: "bg-amber-600",
  },
  low: {
    label: "Resolve blockers",
    bg: "bg-rose-50",
    fg: "text-rose-900",
    ring: "ring-rose-200/80",
    dot: "bg-rose-600",
  },
};

export function ConfidenceBadge({
  level,
  className,
}: {
  level: ConfidenceLevel;
  className?: string;
}) {
  const s = styles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ring-1 ring-inset",
        s.bg,
        s.fg,
        s.ring,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
      {s.label}
    </span>
  );
}
