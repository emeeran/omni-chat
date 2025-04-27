"use client";
import React, { useEffect, useState, createContext, ReactNode } from "react";

// Define theme types
type Theme = "light" | "dark" | "system";
type ColorTheme = "blue" | "teal" | "purple" | "gray";

// Define ThemeContext type
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
}

// Create context with default values
export const ApplicationThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  colorTheme: "blue",
  setColorTheme: () => {},
});

export function ApplicationThemeProvider({ children }: { children: ReactNode }) {
  // Initialize states from localStorage or defaults with fallbacks
  const [theme, setThemeState] = useState<Theme>("system");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("blue");

  // Initialize from localStorage once component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("theme") as Theme;
      const storedColorTheme = localStorage.getItem("colorTheme") as ColorTheme;
      
      if (storedTheme) setThemeState(storedTheme);
      if (storedColorTheme) setColorThemeState(storedColorTheme);
    }
  }, []);

  // Apply theme classes directly
  const applyThemeClasses = (newTheme: Theme, newColorTheme: ColorTheme) => {
    if (typeof window === "undefined") return;
    
    const root = window.document.documentElement;
    
    // 1. Remove existing theme classes
    root.classList.remove("light", "dark");
    root.classList.remove("theme-blue", "theme-teal", "theme-purple", "theme-gray");
    
    // 2. Determine effective theme
    let effectiveTheme = newTheme;
    if (newTheme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    
    // 3. Apply theme classes
    root.classList.add(effectiveTheme);
    root.classList.add(`theme-${newColorTheme}`);
    
    // 4. Force repaint to ensure styles apply (helps with theme switching issues)
    document.body.style.display = 'none';
    document.body.offsetHeight; // Force reflow
    document.body.style.display = '';
  };

  // Function to set theme
  const setTheme = (newTheme: Theme) => {
    if (typeof window === "undefined") return;
    
    // Update state
    setThemeState(newTheme);
    
    // Save to localStorage
    localStorage.setItem("theme", newTheme);
    
    // Apply classes immediately
    applyThemeClasses(newTheme, colorTheme);
  };

  // Function to set color theme
  const setColorTheme = (newColorTheme: ColorTheme) => {
    if (typeof window === "undefined") return;
    
    // Update state
    setColorThemeState(newColorTheme);
    
    // Save to localStorage
    localStorage.setItem("colorTheme", newColorTheme);
    
    // Apply classes immediately
    applyThemeClasses(theme, newColorTheme);
  };

  // Apply theme on mount and when theme/colorTheme changes
  useEffect(() => {
    if (theme && colorTheme) {
      applyThemeClasses(theme, colorTheme);
    }
  }, [theme, colorTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system") {
        applyThemeClasses(theme, colorTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, colorTheme]);

  return (
    <ApplicationThemeContext.Provider value={{ theme, setTheme, colorTheme, setColorTheme }}>
      {children}
    </ApplicationThemeContext.Provider>
  );
} 