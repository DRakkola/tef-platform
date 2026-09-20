/**
 * ThemeSwitcher: Accessible control for toggling light, dark, and system themes.
 * Supports segmented control and compact dropdown/icon button modes.
 */

import React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme, type Theme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ThemeSwitcherProps {
  variant?: "segmented" | "dropdown" | "cycle";
  className?: string;
  size?: "sm" | "default" | "lg";
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = "dropdown",
  className,
  size = "default",
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // 1. Segmented Control Mode (ideal for Settings and Design System)
  if (variant === "segmented") {
    const options: Array<{ value: Theme; label: string; icon: React.FC<{ className?: string }> }> = [
      { value: "light", label: "Clair", icon: Sun },
      { value: "dark", label: "Sombre", icon: Moon },
      { value: "system", label: "Système", icon: Laptop },
    ];

    return (
      <div
        role="radiogroup"
        aria-label="Sélection du thème d'affichage"
        className={cn(
          "inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 gap-1 select-none",
          className
        )}
      >
        {options.map((opt) => {
          const isSelected = theme === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-card text-foreground shadow-2xs font-semibold border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Simple Cycle Button Mode
  if (variant === "cycle") {
    const cycleNext = () => {
      if (theme === "light") setTheme("dark");
      else if (theme === "dark") setTheme("system");
      else setTheme("light");
    };

    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={cycleNext}
        aria-label={`Thème actuel: ${theme}. Cliquer pour changer.`}
        className={cn("text-muted-foreground hover:text-foreground cursor-pointer", className)}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="size-4 text-foreground" />
        ) : (
          <Sun className="size-4 text-foreground" />
        )}
      </Button>
    );
  }

  // 3. Dropdown Menu Mode (default for Header & Sidebar)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "sm" ? "icon-sm" : "icon"}
          aria-label="Choisir le thème d'affichage"
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer rounded-lg",
            className
          )}
        >
          {resolvedTheme === "dark" ? (
            <Moon className="size-4 text-foreground" />
          ) : (
            <Sun className="size-4 text-foreground" />
          )}
          <span className="sr-only">Changer de thème</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-xl p-1 bg-card border border-border shadow-lg">
        <DropdownMenuItem
          className={cn("cursor-pointer text-xs flex items-center gap-2", theme === "light" && "font-semibold bg-accent text-accent-foreground")}
          onClick={() => setTheme("light")}
        >
          <Sun className="size-3.5" />
          <span>Clair</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("cursor-pointer text-xs flex items-center gap-2", theme === "dark" && "font-semibold bg-accent text-accent-foreground")}
          onClick={() => setTheme("dark")}
        >
          <Moon className="size-3.5" />
          <span>Sombre</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("cursor-pointer text-xs flex items-center gap-2", theme === "system" && "font-semibold bg-accent text-accent-foreground")}
          onClick={() => setTheme("system")}
        >
          <Laptop className="size-3.5" />
          <span>Système</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
