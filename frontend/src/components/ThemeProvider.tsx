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
export const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  colorTheme: "blue",
  setColorTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize states from localStorage or defaults
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "system";
    }
    return "system";
  });
  
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("colorTheme") as ColorTheme) || "blue";
    }
    return "blue";
  });

  // Set theme function that updates state and DOM
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    
    // Apply theme class to document
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      
      // Remove existing theme classes
      root.classList.remove("light", "dark");
      
      // Apply appropriate theme
      if (newTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(newTheme);
      }
    }
  };

  // Set color theme function that updates state and DOM
  const setColorTheme = (newColorTheme: ColorTheme) => {
    setColorThemeState(newColorTheme);
    localStorage.setItem("colorTheme", newColorTheme);
    
    // Apply color theme class to document
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      
      // Remove existing color theme classes
      root.classList.remove("theme-blue", "theme-teal", "theme-purple", "theme-gray");
      
      // Apply new color theme
      root.classList.add(`theme-${newColorTheme}`);
    }
  };

  // Effect for initial theme application
  useEffect(() => {
    setTheme(theme);
  }, []);

  // Effect for initial color theme application
  useEffect(() => {
    setColorTheme(colorTheme);
  }, []);

  // Effect to listen for system theme changes
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
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