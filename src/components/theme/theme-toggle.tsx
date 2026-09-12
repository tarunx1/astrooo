"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useId, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const selectId = useId();
  const [focused, setFocused] = useState(false);
  const Icon = THEME_ICONS[theme];

  return (
    <label
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground-muted transition hover:bg-surface hover:text-foreground",
        focused && "outline outline-2 outline-offset-2 outline-accent-cyan",
        className,
      )}
      htmlFor={selectId}
      title="Theme"
    >
      <span className="sr-only">Theme</span>
      <Icon aria-hidden="true" size={18} />
      <select
        aria-label="Theme"
        className="absolute inset-0 cursor-pointer opacity-0"
        id={selectId}
        onBlur={() => setFocused(false)}
        onChange={(event) => setTheme(event.target.value as ThemePreference)}
        onFocus={() => setFocused(true)}
        value={theme}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {THEME_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

