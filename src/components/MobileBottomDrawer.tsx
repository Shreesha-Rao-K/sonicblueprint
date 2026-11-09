// SonicBlueprint Mobile Bottom Drawer
// Spring-animated bottom drawer with 45% (half) and 90% (full) snap detents,
// drag handle, backdrop blur dismissal, and safe area spacing.
"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { calculateSnapDetent } from "@/lib/sequencer-kinetics";
import { cn } from "@/lib/cn";

export interface MobileBottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | undefined;
  children: React.ReactNode;
  initialSnap?: number | undefined; // 0.45 or 0.90
  className?: string | undefined;
}

export function MobileBottomDrawer(props: MobileBottomDrawerProps) {
  if (!props.isOpen) return null;
  return <MobileBottomDrawerContent {...props} />;
}

function MobileBottomDrawerContent({
  onClose,
  title = "Studio Controls",
  children,
  initialSnap = 0.45,
  className,
}: MobileBottomDrawerProps) {
  const [snapDetent, setSnapDetent] = useState<number>(initialSnap);
  const [prevInitialSnap, setPrevInitialSnap] = useState<number>(initialSnap);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragY, setDragY] = useState<number>(0);

  // Synchronize snap detent during render if initialSnap prop updates while drawer is mounted
  if (initialSnap !== prevInitialSnap) {
    setPrevInitialSnap(initialSnap);
    setSnapDetent(initialSnap);
  }

  const startYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startYRef.current = e.clientY;
    startTimeRef.current = performance.now();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dy = e.clientY - startYRef.current;
    // Positive dy = dragging down
    setDragY(dy);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);

    const windowH = window.innerHeight || 800;
    const currentHeightPx = snapDetent * windowH - dragY;
    const currentRatio = Math.max(0, Math.min(0.95, currentHeightPx / windowH));

    const dt = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = (dragY / dt) * 1000; // px / sec
    const velocityRatio = velocity / windowH;

    const targetDetent = calculateSnapDetent(currentRatio, velocityRatio, [0, 0.45, 0.9]);
    setDragY(0);

    if (targetDetent === 0) {
      onClose();
    } else {
      setSnapDetent(targetDetent);
    }
  };

  const heightPercent = snapDetent * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer surface with spring animation and dynamic viewport height */}
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] pb-safe transition-all",
          isDragging ? "transition-none" : "duration-250 ease-out",
          className
        )}
        style={{
          height: `${heightPercent}dvh`,
          maxHeight: "100dvh",
          transform: isDragging && dragY > 0 ? `translate3d(0, ${dragY}px, 0)` : undefined,
          transitionTimingFunction: "var(--ease-spring)",
        }}
      >
        {/* Drag handle header */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 active:cursor-grabbing touch-none"
        >
          {/* Centered pill handle */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2">
            <div className="h-1.5 w-12 rounded-full bg-[var(--border-interactive)] opacity-60" />
          </div>

          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {title}
          </span>

          <div className="flex items-center gap-1">
            {/* Toggle snap button */}
            <button
              type="button"
              onClick={() => setSnapDetent(snapDetent >= 0.8 ? 0.45 : 0.9)}
              className="tactile-button grid h-7 w-7 place-items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title={snapDetent >= 0.8 ? "Snap to half height (45%)" : "Snap to full height (90%)"}
              aria-label={snapDetent >= 0.8 ? "Snap to half height" : "Snap to full height"}
            >
              {snapDetent >= 0.8 ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="tactile-button grid h-7 w-7 place-items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-rose-400"
              title="Close drawer"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
