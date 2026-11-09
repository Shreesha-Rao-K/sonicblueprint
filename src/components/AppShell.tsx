// App shell: desktop sidebar + mobile header & touch navigation dock.
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, LayoutDashboard, FolderOpen, Library, Settings, PlusCircle, GraduationCap, Keyboard } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { A11yLiveAnnouncer } from "@/components/A11yLiveAnnouncer";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/presets", label: "Presets", icon: Library },
  { href: "/tutorials", label: "Tutorials", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target;
        if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) {
          return;
        }
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-[100dvh] bg-[var(--bg-void)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--text-on-accent)]"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside
        className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:flex"
        aria-label="Primary"
      >
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]"
          >
            <AudioWaveform className="h-5 w-5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-wide text-[var(--text-primary)]">
              SONICBLUEPRINT
            </span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              DAW Studio
            </span>
          </span>
        </Link>

        {/* Theme Switcher in Sidebar */}
        <div className="mb-5 px-1">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Theme
          </div>
          <ThemeSwitcher variant="compact" className="w-full" />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active =
              path === n.href || (n.href === "/dashboard" && path.startsWith("/studio"));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors tactile-button",
                  active
                    ? "bg-[var(--accent-primary)]/15 text-[var(--text-primary)] font-semibold shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--accent-primary)] shadow-[var(--accent-glow)]"
                  />
                )}
                <n.icon aria-hidden="true" className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/dashboard?new=1"
          className="tactile-button mt-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--accent-glow)] hover:bg-[var(--accent-hover)]"
        >
          <PlusCircle aria-hidden="true" className="h-4 w-4" /> New Project
        </Link>

        <button
          type="button"
          onClick={() => setShowShortcuts(true)}
          className="tactile-button mt-2 flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-interactive)]"
        >
          <Keyboard aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Shortcuts (?)</span>
        </button>

        <div className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-[var(--text-muted)]">
          In-browser DAW & synthesis.
          <br />
          Zero network dependencies.
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 px-3 py-2.5 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <AudioWaveform aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
            <span className="truncate text-sm font-extrabold tracking-wide text-[var(--text-primary)]">
              SONICBLUEPRINT
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard Shortcuts"
              title="Keyboard Shortcuts (?)"
              className="tactile-button grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <ThemeSwitcher variant="compact" />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>

        {/* Mobile Touch Navigation Dock (48px touch targets, safe area bottom padding) */}
        <nav
          aria-label="Mobile Navigation Dock"
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 px-2 pt-1 pb-safe backdrop-blur md:hidden"
        >
          {NAV.map((n) => {
            const active =
              path === n.href || (n.href === "/dashboard" && path.startsWith("/studio"));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                  active
                    ? "text-[var(--accent-primary)] font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <n.icon aria-hidden="true" className="h-5 w-5" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <A11yLiveAnnouncer />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
