import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ className = '', withLabel = false }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const Icon = darkMode ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      className={`btn btn-ghost ${withLabel ? 'justify-start' : 'btn-icon'} ${className}`}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Light mode' : 'Dark mode'}
    >
      <Icon className="h-4 w-4" />
      {withLabel && <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
};

export default ThemeToggle;
