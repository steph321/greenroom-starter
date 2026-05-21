import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function WarningBanner({
  variant = "warning",
  title,
  children,
  className,
}: {
  variant?: "warning" | "danger" | "info";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    warning: {
      wrap: "border-amber-200/70 bg-amber-50/60",
      icon: "text-amber-800",
      title: "text-amber-950",
      body: "text-amber-900/90",
    },
    danger: {
      wrap: "border-rose-200/70 bg-rose-50/50",
      icon: "text-rose-800",
      title: "text-rose-950",
      body: "text-rose-900/90",
    },
    info: {
      wrap: "border-sky-200/70 bg-sky-50/50",
      icon: "text-sky-800",
      title: "text-sky-950",
      body: "text-sky-900/90",
    },
  }[variant];

  const Icon = variant === "info" ? Info : AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3.5 flex gap-3",
        styles.wrap,
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", styles.icon)} />
      <div className="min-w-0">
        <div className={cn("text-[13px] font-semibold", styles.title)}>
          {title}
        </div>
        {children && (
          <div
            className={cn(
              "text-[12.5px] mt-1 leading-relaxed",
              styles.body,
            )}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
