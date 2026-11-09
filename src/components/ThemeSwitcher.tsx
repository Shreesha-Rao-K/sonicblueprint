"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme-store";
import { THEMES, type DawTheme } from "@/styles/themes";
import { cn } from "@/lib/cn";
import { Check, Sparkles, Sliders, Monitor } from "lucide-react";
import { announce } from "@/lib/a11y-announcer";

interface ThemeSwitcherProps {
  variant?: "compact" | "cards";
  className?: string;
}

export function ThemeSwitcher({ variant = "compact", className }: ThemeSwitcherProps) {
  const { theme, setTheme, initialize } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const themesList = Object.values(THEMES);

  const onRadioKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % themesList.length;
      const nextTheme = themesList[nextIdx].id as DawTheme;
      setTheme(nextTheme);
      announce(`Switched to ${themesList[nextIdx].name} theme`);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + themesList.length) % themesList.length;
      const prevTheme = themesList[prevIdx].id as DawTheme;
      setTheme(prevTheme);
      announce(`Switched to ${themesList[prevIdx].name} theme`);
    }
  };

  if (variant === "cards") {
    return (
      <div
        role="radiogroup"
        aria-label="DAW Visual Theme Selection"
        className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}
      >
        {themesList.map((t, idx) => {
          const isSelected = theme === t.id;
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onKeyDown={(e) => onRadioKeyDown(e, idx)}
              onClick={() => {
                setTheme(t.id as DawTheme);
                announce(`Switched to ${t.name} theme`);
              }}
              className={cn(
                "tactile-button relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all",
                isSelected
                  ? "border-[var(--border-focus)] bg-[var(--bg-surface)] shadow-[var(--accent-glow)] ring-1 ring-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-interactive)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                    {t.id === "cyberpunk" && <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />}
                    {t.id === "analog" && <Sliders className="h-4 w-4 text-[var(--accent-primary)]" />}
                    {t.id === "slate" && <Monitor className="h-4 w-4 text-[var(--accent-primary)]" />}
                    {t.name}
                  </span>
                  {isSelected && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent-primary)] text-[var(--text-on-accent)]">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {t.description}
                </p>
              </div>

              {/* Color swatch palette */}
              <div className="mt-4 flex items-center gap-1.5 pt-2">
                <span
                  title="Primary Accent"
                  className="h-4 w-4 rounded-full border border-black/30 shadow-sm"
                  style={{ backgroundColor: t.tokens.accentPrimary }}
                />
                <span
                  title="Secondary Accent"
                  className="h-4 w-4 rounded-full border border-black/30 shadow-sm"
                  style={{ backgroundColor: t.tokens.accentSecondary }}
                />
                <span
                  title="Tertiary Accent"
                  className="h-4 w-4 rounded-full border border-black/30 shadow-sm"
                  style={{ backgroundColor: t.tokens.accentTertiary }}
                />
                <span
                  title="Surface Background"
                  className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: t.tokens.bgSurface }}
                />
                <span
                  title="Void Background"
                  className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: t.tokens.bgVoid }}
                />
                <span className="ml-auto text-[11px] font-mono text-[var(--text-muted)]">
                  {t.id}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant: Segmented pill controls
  return (
    <div
      role="radiogroup"
      aria-label="DAW Visual Theme Switcher"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1",
        className
      )}
    >
      {themesList.map((t, idx) => {
        const isSelected = theme === t.id;
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={(e) => onRadioKeyDown(e, idx)}
            onClick={() => {
              setTheme(t.id as DawTheme);
              announce(`Switched to ${t.name} theme`);
            }}
            title={t.name}
            className={cn(
              "tactile-button flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-all",
              isSelected
                ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                isSelected ? "bg-current" : "border border-white/30"
              )}
              style={{ backgroundColor: isSelected ? undefined : t.tokens.accentPrimary }}
              aria-hidden="true"
            />
            <span className="truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
