"use client";

import { useThemeStore, type ThemeName } from "@/store/theme-store";
import { cn } from "@/lib/utils";
import { Palette, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const THEMES: { key: ThemeName; name: string; desc: string; swatch: [string, string, string] }[] = [
  {
    key: "sereno",
    name: "Institucional Sereno",
    desc: "Lectura ejecutiva, tarjetas blancas, sans geométrica.",
    swatch: ["#FAFAFA", "#FFFFFF", "#2F4A6D"],
  },
  {
    key: "editorial",
    name: "Editorial Académico",
    desc: "Tono memorando, titulares serif, reglas visibles.",
    swatch: ["#F4F1EC", "#FBF9F5", "#2F4A6D"],
  },
  {
    key: "nocturno",
    name: "Nocturno Sobrio",
    desc: "Grafito y latón, salas de profesores, alto contraste.",
    swatch: ["#0F1115", "#1A1D23", "#A98B5D"],
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useThemeStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="gap-2 hairline"
          aria-label="Cambiar tema visual"
        >
          <Palette className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Tema</span>}
          <span className="flex -space-x-1">
            {THEMES.map((t) => (
              <span
                key={t.key}
                className="h-3 w-3 rounded-full border border-border"
                style={{ background: t.swatch[2] }}
                aria-hidden
              />
            ))}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Estilo visual
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => {
          const active = theme === t.key;
          return (
            <DropdownMenuItem
              key={t.key}
              onClick={() => setTheme(t.key)}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <div className="flex gap-1 pt-1">
                {t.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ background: c }}
                    aria-hidden
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {t.name}
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {t.desc}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
