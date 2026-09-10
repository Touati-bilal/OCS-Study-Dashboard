import { cn } from "@/lib/utils";

const baseClass =
  "w-full rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2.5 text-sm text-ink placeholder:text-ink/30 outline-none transition focus:border-brand-500/60 focus:bg-ink/[0.06] focus:ring-2 focus:ring-brand-500/20";

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-ink/60">{children}</label>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(baseClass, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(baseClass, "resize-none", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(baseClass, "appearance-none", props.className)}>
      {props.children}
    </select>
  );
}

export function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3.5", className)}>{children}</div>;
}
