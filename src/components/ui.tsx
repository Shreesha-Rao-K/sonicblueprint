// Minimal shadcn-style primitives (no extra deps) with theme token integration.
import * as React from "react";
import { cn } from "@/lib/cn";

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const base =
    "tactile-button inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-50 disabled:pointer-events-none rounded-lg active:translate-y-px";
  const variants: Record<string, string> = {
    default:
      "bg-[var(--accent-primary)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] shadow-[var(--accent-glow)] font-semibold",
    ghost: "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]",
    outline:
      "border border-[var(--border-interactive)] text-[var(--text-secondary)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)]/40",
    danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-[15px]",
    icon: "h-10 w-10",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 text-[var(--text-primary)] shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
}

export function Slider(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className="h-6 w-full cursor-pointer disabled:opacity-40" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)]"
      {...props}
    />
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)]"
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-primary)]",
        className
      )}
      {...props}
    />
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">{children}</h2>
      {right}
    </div>
  );
}
