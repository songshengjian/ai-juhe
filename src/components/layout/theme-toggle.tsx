"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme(): void {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("chat-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? "切换到浅色主题" : "切换到深色主题"}
      onClick={toggleTheme}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
