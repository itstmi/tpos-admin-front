import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);

function savedTheme() {
  try {
    const saved = localStorage.getItem('tpos-admin-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // storage blocked, fall through to the system setting
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(savedTheme);

  useEffect(() => {
    try {
      localStorage.setItem('tpos-admin-theme', theme);
    } catch {
      // not saved, the theme still applies for this visit
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
