"use client";

import { createContext, useContext } from "react";
import type { BoardContext } from "@/components/board/Board";

const Ctx = createContext<BoardContext | null>(null);

export function BoardContextProvider({ value, children }: { value: BoardContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoardContext(): BoardContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoardContext must be used within BoardContextProvider");
  return ctx;
}
