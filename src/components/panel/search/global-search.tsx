"use client";

// [F2] Búsqueda global — dos modos según dispositivo:
//  • Escritorio: `InlineGlobalSearch` — la lupa se expande con animación en una barra
//    de búsqueda dentro del topbar y despliega resultados en panel anclado (sin lightbox).
//  • Móvil: `GlobalSearch` — lightbox (dialog) a pantalla ajustada, sin cortes.
// Busca estudiantes y publicaciones (API /api/search, que respeta permisos).
// Navegación ↑↓/Enter/Esc vía cmdk; búsquedas recientes (localStorage, últimas 5).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { FileText, MessageSquare, Search, User, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Estado compartido de la búsqueda (la lupa/⌘K lo abren; recents se refrescan al abrir). */
export const useSearchOpen = create<{ open: boolean; recents: string[]; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  recents: [],
  setOpen: (open) => set(open ? { open, recents: loadRecents() } : { open }),
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

/** Lógica compartida de búsqueda con debounce (200ms) y descarte de respuestas obsoletas. */
function useSearchFetch(query: string) {
  const user = useAuthStore((s) => s.user);
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

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
        // silencioso: la búsqueda sigue usable
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, user]);

  return { students, posts, loading };
}

/** Lista de resultados compartida por ambos modos (cmdk sin filtrado local). */
const commandCls = "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4";

function SearchResults({
  query,
  students,
  posts,
  loading,
  recents,
  onQueryChange,
  onRunRecent,
  onPickStudent,
  onPickPost,
}: {
  query: string;
  students: StudentHit[];
  posts: PostHit[];
  loading: boolean;
  recents: string[];
  onQueryChange?: (q: string) => void; // presente = renderiza input (lightbox móvil)
  onRunRecent: (q: string) => void;
  onPickStudent: (s: StudentHit) => void;
  onPickPost: (p: PostHit) => void;
}) {
  const total = students.length + posts.length;
  const statusChip = useMemo(
    () => ({ activo: "bg-green-100 text-green-700", retirado: "bg-slate-100 text-slate-600" }),
    []
  );
  return (
    <Command shouldFilter={false} className={commandCls}>
      {onQueryChange && (
        <CommandInput
          placeholder="Buscar estudiantes o publicaciones…"
          value={query}
          onValueChange={onQueryChange}
        />
      )}
      <CommandList>
        {query.trim().length < 2 && recents.length > 0 && (
          <CommandGroup heading="Búsquedas recientes">
            {recents.map((r) => (
              <CommandItem key={r} value={`recent-${r}`} onSelect={() => onRunRecent(r)}>
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
                onSelect={() => onPickStudent(s)}
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
                onSelect={() => onPickPost(p)}
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
      <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span><kbd className="font-mono">↑↓</kbd> navegar</span>
        <span><kbd className="font-mono">Enter</kbd> abrir</span>
        <span><kbd className="font-mono">Esc</kbd> cerrar</span>
      </div>
    </Command>
  );
}

/** Modo escritorio: lupa que se expande con animación en barra de búsqueda inline. */
export function InlineGlobalSearch() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const setSearchTarget = useUIStore((s) => s.setSearchTarget);
  const router = useRouter();
  const open = useSearchOpen((s) => s.open);
  const setOpen = useSearchOpen((s) => s.setOpen);
  const recents = useSearchOpen((s) => s.recents);

  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const { students, posts, loading } = useSearchFetch(query);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  // ⌘K / Ctrl+K abre/cierra el modo inline (solo montado en escritorio)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useSearchOpen.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Click fuera o Esc cierra (con reset de la consulta)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeAndReset();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndReset();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeAndReset]);

  const pickStudent = useCallback(
    (s: StudentHit) => {
      saveRecent(query.trim());
      closeAndReset();
      setModule("gestion-estudiantes");
      setSearchTarget({ studentId: s.id, ts: Date.now() });
      router.refresh();
    },
    [query, setModule, setSearchTarget, router, closeAndReset]
  );

  const pickPost = useCallback(
    (p: PostHit) => {
      saveRecent(query.trim());
      closeAndReset();
      setModule("comunidad");
      setSearchTarget({ postId: p.id, spaceId: p.spaceId, ts: Date.now() });
      router.refresh();
    },
    [query, setModule, setSearchTarget, router, closeAndReset]
  );

  const runRecent = useCallback((q: string) => {
    setQuery(q);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      {/* Barra expandible: colapsada = lupa (botón); abierta = input con resultados anclados */}
      <div
        role={open ? undefined : "button"}
        tabIndex={open ? -1 : 0}
        aria-label={open ? undefined : "Buscar (Ctrl+K)"}
        title={open ? undefined : "Buscar (Ctrl+K)"}
        onKeyDown={
          open
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }
        }
        className={cn(
          "flex items-center gap-2 h-9 rounded-lg border bg-secondary/40 transition-all duration-200 ease-out",
          open ? "w-72 xl:w-96 px-3 bg-background shadow-sm ring-1 ring-ring/30" : "w-9 justify-center px-0 hover:bg-secondary cursor-pointer"
        )}
        onClick={() => !open && setOpen(true)}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        {open && (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar estudiantes, grupos…"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              aria-label="Buscar estudiantes o publicaciones"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Panel de resultados anclado al topbar (no modal) */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[26rem] xl:w-[30rem] overflow-hidden rounded-xl border bg-popover shadow-lg">
          <SearchResults
            query={query}
            students={students}
            posts={posts}
            loading={loading}
            recents={recents}
            onRunRecent={runRecent}
            onPickStudent={pickStudent}
            onPickPost={pickPost}
          />
        </div>
      )}
    </div>
  );
}

/** Modo móvil: lightbox (dialog) — no se renderiza en escritorio. */
export function GlobalSearch() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const setSearchTarget = useUIStore((s) => s.setSearchTarget);
  const open = useSearchOpen((s) => s.open);
  const setOpen = useSearchOpen((s) => s.setOpen);
  const recents = useSearchOpen((s) => s.recents);
  const router = useRouter();
  const isMobile = useIsMobile();

  const [query, setQuery] = useState("");
  const { students, posts, loading } = useSearchFetch(query);

  const pickStudent = useCallback(
    (s: StudentHit) => {
      saveRecent(query.trim());
      setOpen(false);
      setQuery("");
      setModule("gestion-estudiantes");
      setSearchTarget({ studentId: s.id, ts: Date.now() });
      router.refresh();
    },
    [query, setModule, setSearchTarget, router, setOpen]
  );

  const pickPost = useCallback(
    (p: PostHit) => {
      saveRecent(query.trim());
      setOpen(false);
      setQuery("");
      setModule("comunidad");
      setSearchTarget({ postId: p.id, spaceId: p.spaceId, ts: Date.now() });
      router.refresh();
    },
    [query, setModule, setSearchTarget, router, setOpen]
  );

  const runRecent = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const onOpenChange = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (!o) setQuery("");
    },
    [setOpen]
  );

  if (!isMobile) return null;

  return (
    <Dialog open={open && isMobile} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 w-[calc(100vw-1.5rem)] max-w-[600px] top-6 translate-y-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Búsqueda global</DialogTitle>
          <DialogDescription>Buscar estudiantes o publicaciones</DialogDescription>
        </DialogHeader>
        <SearchResults
          query={query}
          students={students}
          posts={posts}
          loading={loading}
          recents={recents}
          onQueryChange={setQuery}
          onRunRecent={runRecent}
          onPickStudent={pickStudent}
          onPickPost={pickPost}
        />
      </DialogContent>
    </Dialog>
  );
}
