import { cn } from "@/lib/utils";

export function Badge({
  children,
  color,
  className,
  variant = "solid",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
  variant?: "solid" | "outline";
}) {
  if (variant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
          className
        )}
        style={{ borderColor: (color ?? "#48a3ff") + "55", color: color ?? "#48a3ff" }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-ink",
        className
      )}
      style={{ backgroundColor: (color ?? "#48a3ff") + "26", color: color ?? "#48a3ff" }}
    >
      {children}
    </span>
  );
}
