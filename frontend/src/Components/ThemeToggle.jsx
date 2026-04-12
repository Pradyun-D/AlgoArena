import { useTheme } from "../Theme/ThemeProvider";

function ThemeToggle({ className = "" }) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="material-symbols-outlined">
        {isDarkMode ? "light_mode" : "dark_mode"}
      </span>
      <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}

export default ThemeToggle;
