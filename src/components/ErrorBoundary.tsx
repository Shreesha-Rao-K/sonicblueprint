// Simple error boundary for editor panels.
"use client";

import * as React from "react";

export class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode; label: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[SonicBlueprint:${this.props.label}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5" role="alert">
          <p className="font-bold text-red-200">This part of the studio hit a snag</p>
          <p className="mt-1 text-[13px] text-red-200/70">Don&apos;t worry — your song is still safe. You can try showing this panel again.</p>
          <button
            className="mt-3 rounded-lg border border-red-500/40 px-3 py-1.5 text-[13px] text-red-200 hover:bg-red-500/10"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
