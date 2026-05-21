import type { Discrepancy } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const severityStyles = {
  blocking: {
    border: "border-rose-200/80",
    bg: "bg-rose-50/40",
    label: "Blocking",
    labelBg: "bg-rose-100 text-rose-800 ring-rose-200/80",
  },
  warning: {
    border: "border-amber-200/80",
    bg: "bg-amber-50/30",
    label: "Warning",
    labelBg: "bg-amber-100 text-amber-900 ring-amber-200/80",
  },
  info: {
    border: "border-ink-200/80",
    bg: "bg-canvas-soft",
    label: "Note",
    labelBg: "bg-ink-100 text-ink-700 ring-ink-200/80",
  },
};

export function DiscrepancyCards({
  items,
  emptyMessage = "No conflicts between deal notes and booking fields.",
}: {
  items: Discrepancy[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-500 leading-relaxed py-1">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((d) => {
        const s = severityStyles[d.severity];
        return (
          <li
            key={d.id}
            className={cn(
              "rounded-lg border px-4 py-3",
              s.border,
              s.bg,
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[13px] font-medium text-ink-900">
                {d.title}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset",
                  s.labelBg,
                )}
              >
                {s.label}
              </span>
            </div>
            <p className="text-[12.5px] text-ink-600 leading-relaxed">
              {d.body}
            </p>
            {d.suggestedAction && (
              <p className="text-[11.5px] text-ink-500 mt-2 font-medium">
                → {d.suggestedAction}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
