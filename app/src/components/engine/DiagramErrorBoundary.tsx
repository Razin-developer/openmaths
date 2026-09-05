"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackClassName?: string;
}

interface State {
  hasError: boolean;
}

/** Keeps a diagram-rendering crash from taking down the whole canvas/dialog around it. */
export class DiagramErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[DiagramErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={
            this.props.fallbackClassName ??
            "flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-muted-foreground"
          }
        >
          <AlertTriangle className="size-4" />
          Couldn&apos;t render this diagram.
        </div>
      );
    }
    return this.props.children;
  }
}
