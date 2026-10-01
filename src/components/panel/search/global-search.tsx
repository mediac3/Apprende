"use client";

// [F2] Búsqueda global — command palette (⌘K / Ctrl+K).
// Busca estudiantes y publicaciones de espacios (API /api/search, que respeta
// permisos). Resultados agrupados, navegación ↑↓/Enter/Esc vía cmdk,
// búsquedas recientes (localStorage, últimas 5) con input vacío.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { FileText, MessageSquare, Search, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";

/** Estado compartido de la palette (el trigger de la barra superior la abre). */
export const useSearchOpen = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface StudentHit {
  id: string; code: string; firstName: string; lastName: string;
  status: string; groupName: string | null;
}
interface PostHit {
  id: string; snippet: string; createdAt: string;
  spaceId: string | null; spaceName: string | null; authorName: string;
}

const RECENTS_KEY = "apprende:recent-searches";
const RECENTS_MAX = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  try {
    const next = [q, ...loadRecents().filter((r) => r !== q)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // almacenamiento no disponible: ignorar
  }
}

export function GlobalSearch() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const setSearchTarget = useUIStore((s) => s.setSearchTarget);
  const open = useSearchOpen((s) => s.open);
  const setOpen = useSearchOpen((s) => s.setOpen);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const seqRef = useRef(0);

  // ⌘K / Ctrl+K global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Estado efímero: al abrir se resetea y muestra recientes
  useEffect(() => {
    if (open) {
      setRecents(loadRecents());
    } else {
      setQuery("");
      setStudents([]);
      setPosts([]);
    }
  }, [open]);

  // Búsqueda con debounce 200ms
  useEffect(() => {
    const q = query.trim();
    if (!user || q.length < 2) {
      setStudents([]);
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&institutionId=${encodeURIComponent(user.institution.id)}&userId=${encodeURIComponent(user.id)}`
        );
        const json = await res.json();
        if (seq !== seqRef.current) return; // respuesta obsoleta
        if (res.ok && json.ok) {
          setStudents(json.students ?? []);
          setPosts(json.posts ?? []);
        }
      } catch {
        // silencioso: la palette sigue usable
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, user]);

  const total = students.length + posts.length;

  const pickStudent = useCallback(
    (s: StudentHit) => {
      saveRecent(query.trim());
      setOpen(false);
      setModule("gestion-estudiantes");
      setSearchTarget({ studentId: s.id, ts: Date.now() });
      // si el panel vive en la misma ruta, forzar refresco de contexto
      router.refresh();
    },
    [query, setModule, setSearchTarget, router]
  );

  const pickPost = useCallback(
    (p: PostHit) => {
      saveRecent(query.trim());
      setOpen(false);
      setModule("comunidad");
      setSearchTarget({ postId: p.id, spaceId: p.spaceId, ts: Date.now() });
      router.refresh();
    },
    [query, setModule, setSearchTarget, router]
  );

  const runRecent = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const statusChip = useMemo(
    () => ({ activo: "bg-green-100 text-green-700", retirado: "bg-slate-100 text-slate-600" }),
    []
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[600px]">
        <DialogHeader className="sr-only">
          <DialogTitle>Búsqueda global</DialogTitle>
          <DialogDescription>Buscar estudiantes o publicaciones</DialogDescription>
        </DialogHeader>
        {/* shouldFilter=false: el filtrado/permisos se resuelven en servidor (/api/search) */}
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput
            placeholder="Buscar estudiantes o publicaciones…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
        {query.trim().length < 2 && recents.length > 0 && (
          <CommandGroup heading="Búsquedas recientes">
            {recents.map((r) => (
              <CommandItem key={r} value={`recent-${r}`} onSelect={() => runRecent(r)}>
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{r}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {query.trim().length < 2 && recents.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Escribe al menos 2 caracteres para buscar…
          </div>
        )}
        {query.trim().length >= 2 && loading && total === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
        )}
        {query.trim().length >= 2 && !loading && total === 0 && (
          <CommandEmpty>Sin resultados para “{query.trim()}”.</CommandEmpty>
        )}
        {students.length > 0 && (
          <CommandGroup heading={`Estudiantes (${students.length})`}>
            {students.map((s) => (
              <CommandItem
                key={s.id}
                value={`student-${s.code}-${s.firstName}-${s.lastName}-${s.id}`}
                onSelect={() => pickStudent(s)}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {s.firstName} {s.lastName}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.groupName && <span>{s.groupName}</span>}
                  <span className="font-mono">{s.code}</span>
                  <Badge
                    className={`h-4 px-1 text-[10px] ${statusChip[s.status as string] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {s.status}
                  </Badge>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {posts.length > 0 && (
          <CommandGroup heading={`Publicaciones (${posts.length})`}>
            {posts.map((p) => (
              <CommandItem
                key={p.id}
                value={`post-${p.id} ${p.snippet} ${p.spaceName ?? ""} ${p.authorName}`}
                onSelect={() => pickPost(p)}
              >
                {p.spaceName ? (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="truncate">{p.snippet}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {p.spaceName ?? "General"} · {p.authorName.split(" ")[0]}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
        </Command>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> cerrar</span>
          <span className="ml-auto"><kbd className="font-mono">⌘K</kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
