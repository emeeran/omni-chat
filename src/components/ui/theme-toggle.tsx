'use client';

import { useTheme } from '@/lib/providers/theme-provider';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center space-x-2 bg-muted/40 p-1 rounded-lg">
            <button
                onClick={() => setTheme('light')}
                className={`p-2 rounded-md transition-colors ${theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                aria-label="Light mode"
            >
                <SunIcon className="h-5 w-5" />
            </button>

            <button
                onClick={() => setTheme('dark')}
                className={`p-2 rounded-md transition-colors ${theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                aria-label="Dark mode"
            >
                <MoonIcon className="h-5 w-5" />
            </button>

            <button
                onClick={() => setTheme('system')}
                className={`p-2 rounded-md transition-colors ${theme === 'system' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                aria-label="System preference"
            >
                <ComputerDesktopIcon className="h-5 w-5" />
            </button>
        </div>
    );
}