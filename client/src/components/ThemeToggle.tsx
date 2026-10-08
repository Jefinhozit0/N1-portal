import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

/** Switches between the light and dark look; the choice is remembered in this browser. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const label = theme === "dark" ? "Usar modo claro" : "Usar modo escuro";
  return (
    <button type="button" className={`icon-button theme-toggle ${className}`} onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
