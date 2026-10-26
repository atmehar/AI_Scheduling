'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
  mounted: false,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  const applyThemeToDOM = (targetTheme) => {
    if (typeof document === 'undefined') return;
    const isDarkTarget = targetTheme === 'dark';

    if (isDarkTarget) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
      document.body?.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
      document.body?.classList.remove('dark');
    }
  };

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('timesync_theme');
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = saved ? saved : prefersDark ? 'dark' : 'light';

      setTheme(initialTheme);
      applyThemeToDOM(initialTheme);
    } catch (e) {
      console.warn('Theme init error:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('timesync_theme', nextTheme);
      } catch (e) {
        console.warn('Theme storage error:', e);
      }
      applyThemeToDOM(nextTheme);
      return nextTheme;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        isDark: theme === 'dark',
        mounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
