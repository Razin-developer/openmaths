"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

export type FontSize = "sm" | "md" | "lg";
export type FontFamily = "sans" | "serif" | "mono" | "rounded" | "classic";

const SIZE_STORAGE_KEY = "font-size";
const FAMILY_STORAGE_KEY = "font-family";
const PREFS_CHANGE_EVENT = "prefs-change";

export const FONT_SIZE_VALUES: Record<FontSize, string> = {
  sm: "0.75rem",
  md: "0.8125rem",
  lg: "0.9375rem",
};

export const FONT_SIZE_LABEL: Record<FontSize, string> = { sm: "Small", md: "Default", lg: "Large" };

export const FONT_FAMILY_VALUES: Record<FontFamily, string> = {
  sans: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "var(--font-geist-mono), 'Courier New', monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
  classic: "'Times New Roman', Times, serif",
};

export const FONT_FAMILY_LABEL: Record<FontFamily, string> = {
  sans: "Default (Sans)",
  serif: "Serif",
  mono: "Monospace",
  rounded: "Rounded",
  classic: "Classic",
};

/** FOUC-prevention inline script, rendered via next/script(beforeInteractive) in the root layout. */
export const PREFS_INIT_SCRIPT = `
(function () {
  try {
    var sizes = ${JSON.stringify(FONT_SIZE_VALUES)};
    var families = ${JSON.stringify(FONT_FAMILY_VALUES)};
    var size = localStorage.getItem("${SIZE_STORAGE_KEY}") || "md";
    var family = localStorage.getItem("${FAMILY_STORAGE_KEY}") || "sans";
    document.documentElement.style.setProperty("--user-font-size", sizes[size] || sizes.md);
    document.documentElement.style.setProperty("--user-font-family", families[family] || families.sans);
  } catch (e) {}
})();
`.trim();

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFS_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFS_CHANGE_EVENT, callback);
  };
}

function getSizeSnapshot(): FontSize {
  const stored = localStorage.getItem(SIZE_STORAGE_KEY);
  return stored === "sm" || stored === "lg" ? stored : "md";
}

function getFamilySnapshot(): FontFamily {
  const stored = localStorage.getItem(FAMILY_STORAGE_KEY);
  return stored && stored in FONT_FAMILY_VALUES ? (stored as FontFamily) : "sans";
}

function getServerSnapshot() {
  return "md" as const;
}

interface PreferencesContextValue {
  fontSize: FontSize;
  fontFamily: FontFamily;
  setFontSize: (size: FontSize) => void;
  setFontFamily: (family: FontFamily) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const fontSize = useSyncExternalStore(subscribe, getSizeSnapshot, getServerSnapshot);
  const fontFamily = useSyncExternalStore(subscribe, getFamilySnapshot, () => "sans" as const);

  useEffect(() => {
    document.documentElement.style.setProperty("--user-font-size", FONT_SIZE_VALUES[fontSize]);
    document.documentElement.style.setProperty("--user-font-family", FONT_FAMILY_VALUES[fontFamily]);
  }, [fontSize, fontFamily]);

  const setFontSize = useCallback((size: FontSize) => {
    localStorage.setItem(SIZE_STORAGE_KEY, size);
    window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  }, []);

  const setFontFamily = useCallback((family: FontFamily) => {
    localStorage.setItem(FAMILY_STORAGE_KEY, family);
    window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  }, []);

  return (
    <PreferencesContext.Provider value={{ fontSize, fontFamily, setFontSize, setFontFamily }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}
