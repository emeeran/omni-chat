"use client";
import React, { useEffect, useState, createContext, ReactNode } from "react";

const COLOR_THEMES = {
  teal: {
    // Teal/Purple theme
    '--color-primary-50': '#f0fdfa',
    '--color-primary-100': '#ccfbf1',
    '--color-primary-200': '#99f6e4',
    '--color-primary-300': '#5eead4',
    '--color-primary-400': '#2dd4bf',
    '--color-primary-500': '#14b8a6',
    '--color-primary-600': '#0d9488',
    '--color-primary-700': '#0f766e',
    '--color-primary-800': '#115e59',
    '--color-primary-900': '#134e4a',
    '--color-primary-950': '#042f2e',
    '--color-secondary-50': '#f5f3ff',
    '--color-secondary-100': '#ede9fe',
    '--color-secondary-200': '#ddd6fe',
    '--color-secondary-300': '#c4b5fd',
    '--color-secondary-400': '#a78bfa',
    '--color-secondary-500': '#8b5cf6',
    '--color-secondary-600': '#7c3aed',
    '--color-secondary-700': '#6d28d9',
    '--color-secondary-800': '#5b21b6',
    '--color-secondary-900': '#4c1d95',
    '--color-secondary-950': '#2e1065',
    '--color-accent-100': '#fdf6f0',
    '--color-accent-200': '#fce7f3',
    '--color-accent-300': '#fbcfe8',
    '--color-accent-400': '#f9a8d4',
    '--color-accent-500': '#f472b6',
    '--color-accent-600': '#ec4899',
    '--color-glass-100': 'rgba(255,255,255,0.7)',
    '--color-glass-900': 'rgba(24,24,27,0.7)',
    '--color-dark-100': '#d5d7e0',
    '--color-dark-200': '#acaebf',
    '--color-dark-300': '#8c8fa3',
    '--color-dark-400': '#666980',
    '--color-dark-500': '#4d4f66',
    '--color-dark-600': '#34354a',
    '--color-dark-700': '#2c2e3e',
    '--color-dark-800': '#1a1b27',
    '--color-dark-900': '#0c0d21',
    '--color-border': '#e5e7eb',
    '--color-background': '#f9fafb',
    '--color-foreground': '#111827',
  },
  blue: {
    // Blue/Amber theme
    '--color-primary-50': '#eff6ff',
    '--color-primary-100': '#dbeafe',
    '--color-primary-200': '#bfdbfe',
    '--color-primary-300': '#93c5fd',
    '--color-primary-400': '#60a5fa',
    '--color-primary-500': '#3b82f6',
    '--color-primary-600': '#2563eb',
    '--color-primary-700': '#1d4ed8',
    '--color-primary-800': '#1e40af',
    '--color-primary-900': '#1e3a8a',
    '--color-primary-950': '#172554',
    '--color-secondary-50': '#fffbeb',
    '--color-secondary-100': '#fef3c7',
    '--color-secondary-200': '#fde68a',
    '--color-secondary-300': '#fcd34d',
    '--color-secondary-400': '#fbbf24',
    '--color-secondary-500': '#f59e42',
    '--color-secondary-600': '#d97706',
    '--color-secondary-700': '#b45309',
    '--color-secondary-800': '#92400e',
    '--color-secondary-900': '#78350f',
    '--color-secondary-950': '#451a03',
    '--color-accent-100': '#f0f9ff',
    '--color-accent-200': '#e0f2fe',
    '--color-accent-300': '#bae6fd',
    '--color-accent-400': '#7dd3fc',
    '--color-accent-500': '#38bdf8',
    '--color-accent-600': '#0ea5e9',
    '--color-glass-100': 'rgba(255,255,255,0.7)',
    '--color-glass-900': 'rgba(24,24,27,0.7)',
    '--color-dark-100': '#dbeafe',
    '--color-dark-200': '#bfdbfe',
    '--color-dark-300': '#93c5fd',
    '--color-dark-400': '#60a5fa',
    '--color-dark-500': '#3b82f6',
    '--color-dark-600': '#2563eb',
    '--color-dark-700': '#1d4ed8',
    '--color-dark-800': '#1e40af',
    '--color-dark-900': '#1e3a8a',
    '--color-border': '#e0e7ff',
    '--color-background': '#f1f5f9',
    '--color-foreground': '#0f172a',
  },
  classic: {
    // Classic gray/blue theme
    '--color-primary-50': '#f8fafc',
    '--color-primary-100': '#f1f5f9',
    '--color-primary-200': '#e2e8f0',
    '--color-primary-300': '#cbd5e1',
    '--color-primary-400': '#94a3b8',
    '--color-primary-500': '#64748b',
    '--color-primary-600': '#475569',
    '--color-primary-700': '#334155',
    '--color-primary-800': '#1e293b',
    '--color-primary-900': '#0f172a',
    '--color-primary-950': '#020617',
    '--color-secondary-50': '#f0fdfa',
    '--color-secondary-100': '#ccfbf1',
    '--color-secondary-200': '#99f6e4',
    '--color-secondary-300': '#5eead4',
    '--color-secondary-400': '#2dd4bf',
    '--color-secondary-500': '#14b8a6',
    '--color-secondary-600': '#0d9488',
    '--color-secondary-700': '#0f766e',
    '--color-secondary-800': '#115e59',
    '--color-secondary-900': '#134e4a',
    '--color-secondary-950': '#042f2e',
    '--color-accent-100': '#f1f5f9',
    '--color-accent-200': '#e2e8f0',
    '--color-accent-300': '#cbd5e1',
    '--color-accent-400': '#94a3b8',
    '--color-accent-500': '#64748b',
    '--color-accent-600': '#475569',
    '--color-glass-100': 'rgba(255,255,255,0.7)',
    '--color-glass-900': 'rgba(24,24,27,0.7)',
    '--color-dark-100': '#e2e8f0',
    '--color-dark-200': '#cbd5e1',
    '--color-dark-300': '#94a3b8',
    '--color-dark-400': '#64748b',
    '--color-dark-500': '#475569',
    '--color-dark-600': '#334155',
    '--color-dark-700': '#1e293b',
    '--color-dark-800': '#0f172a',
    '--color-dark-900': '#020617',
    '--color-border': '#cbd5e1',
    '--color-background': '#f8fafc',
    '--color-foreground': '#0f172a',
  },
};

export const ThemeContext = createContext({
  theme: "system" as "system" | "light" | "dark",
  setTheme: (() => { }) as React.Dispatch<React.SetStateAction<"system" | "light" | "dark">>,
  colorTheme: "teal" as "teal" | "blue" | "classic",
  setColorTheme: (() => { }) as React.Dispatch<React.SetStateAction<"teal" | "blue" | "classic">>,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark" | "system") || "system";
    }
    return "system";
  });
  const [colorTheme, setColorTheme] = useState<"teal" | "blue" | "classic">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("colorTheme") as "teal" | "blue" | "classic") || "teal";
    }
    return "teal";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const palette = COLOR_THEMES[colorTheme];
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem("colorTheme", colorTheme);
  }, [colorTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}