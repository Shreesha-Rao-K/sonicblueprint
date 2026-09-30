// App shell: sidebar nav + header. Desktop-first, collapses on mobile.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, LayoutDashboard, FolderOpen, Library, Settings, PlusCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/presets", label: "Preset Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen bg-[#06070d]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#6e8bff] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#0b1020]"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-[#1a2340] bg-[#0a0e1a]/95 p-4 md:flex" aria-label="Primary">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#6e8bff] to-[#a78bfa]">
            <AudioWaveform className="h-5 w-5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-wide text-white">SONICBLUEPRINT</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Blueprint builder</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = path === n.href || (n.href === "/dashboard" && path.startsWith("/studio"));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-[#6e8bff]/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#6e8bff]" />
                )}
                <n.icon aria-hidden="true" className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/dashboard?new=1"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#6e8bff] px-3 py-2.5 text-sm font-semibold text-[#0b1020] shadow-[0_0_18px_rgba(110,139,255,0.35)] hover:bg-[#7f99ff]"
        >
          <PlusCircle aria-hidden="true" className="h-4 w-4" /> New Project
        </Link>
        <div className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-slate-400">
          Made for original songs.
          <br />
          All sound is created live in your browser.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#1a2340] bg-[#0a0e1a]/90 px-3 py-2.5 backdrop-blur md:hidden">
          <AudioWaveform aria-hidden="true" className="h-5 w-5 shrink-0 text-[#6e8bff]" />
          <span className="truncate text-sm font-extrabold tracking-wide">SONICBLUEPRINT</span>
          <nav className="ml-auto flex shrink-0 items-center gap-0.5 text-[12px]" aria-label="Mobile">
            <Link href="/dashboard" className="rounded-md px-1.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white">Dashboard</Link>
            <Link href="/projects" className="rounded-md px-1.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white">Projects</Link>
            <Link href="/presets" className="rounded-md px-1.5 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white">Presets</Link>
            <Link href="/settings" className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 hover:text-white" aria-label="Settings" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
      </div>
    </div>
  );
}
