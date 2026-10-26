'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode (white)' : 'Switch to dark mode (black)'}
      className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer"
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <Moon className="w-5 h-5 text-zinc-700 dark:text-zinc-300 hover:-rotate-12 transition-transform" />
        )
      ) : (
        <div className="w-5 h-5" />
      )}
    </button>
  );
}
