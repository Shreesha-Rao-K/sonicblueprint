// Minimal shadcn-style primitives (no extra deps).
import * as React from "react";
import { cn } from "@/lib/cn";

export function Button({
  className, variant = "default", size = "md", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-2 focus-visible:outline-[#6e8bff] disabled:opacity-50 disabled:pointer-events-none rounded-lg active:translate-y-px";
  const variants: Record<string, string> = {
    default: "bg-[#6e8bff] text-[#0b1020] hover:bg-[#7f99ff] shadow-[0_0_18px_rgba(110,139,255,0.35)]",
    ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
    outline: "border border-[#26325a] text-slate-200 hover:border-[#6e8bff] hover:text-white bg-white/[0.02]",
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
      className={cn("rounded-xl border border-[#1e2a4a] bg-[#0e1424]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400", className)} {...props} />;
}

export function Slider(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className="h-6 w-full cursor-pointer disabled:opacity-40" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="h-10 w-full rounded-lg border border-[#26325a] bg-[#0a0e1a] px-3 text-sm text-slate-100 focus:border-[#6e8bff]"
      {...props}
    />
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-10 w-full rounded-lg border border-[#26325a] bg-[#0a0e1a] px-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-[#6e8bff]"
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border border-[#2a3a6b] bg-[#6e8bff]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#aebfff]", className)}
      {...props}
    />
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-300">{children}</h2>
      {right}
    </div>
  );
}
