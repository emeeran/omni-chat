"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useApplicationTheme } from "@/hooks/useApplicationTheme"

export function ThemeToggle() {
  const { setTheme, theme } = useApplicationTheme()

  return (
    <div className="flex gap-2 items-center">
      <button
        type="button"
        className={`p-2 rounded-full border transition-colors ${theme === "light" ? "bg-blue-100 text-blue-700 border-blue-400" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        onClick={() => setTheme("light")}
        title="Light Mode"
      >
        <Sun className="w-5 h-5" />
      </button>
      <button
        type="button"
        className={`p-2 rounded-full border transition-colors ${theme === "dark" ? "bg-blue-100 text-blue-700 border-blue-400" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        onClick={() => setTheme("dark")}
        title="Dark Mode"
      >
        <Moon className="w-5 h-5" />
      </button>
      <button
        type="button"
        className={`p-2 rounded-full border transition-colors ${theme === "system" ? "bg-blue-100 text-blue-700 border-blue-400" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        onClick={() => setTheme("system")}
        title="System Mode"
      >
        <Monitor className="w-5 h-5" />
      </button>
    </div>
  )
} 