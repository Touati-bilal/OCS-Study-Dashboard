import { cn } from "@/lib/utils";

/**
 * Form controls are painted with the opaque `--field-surface` token instead of a translucent
 * `ink/4` tint. A native `<select>` popup does not inherit the page background: with a translucent
 * control the browser composites the option list over its own light default, which renders the
 * white label on white in dark mode. The token is derived from the theme variables in
 * `app/globals.css`, so the control and every option state follow the active theme. The `text-ink`
 * and `placeholder:text-ink/30` classes are tokens too, so the text always has contrast.
 */
const baseClass =
  "w-full rounded-xl border border-ink/10 bg-[var(--field-surface)] px-3 py-2.5 text-sm text-ink placeholder:text-ink/30 outline-none transition focus:border-brand-500/60 focus:bg-[var(--field-surface-hover)] focus:ring-2 focus:ring-brand-500/20";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink/60">
      {children}
    </label>
  );
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
