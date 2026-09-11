"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Send,
  MessageSquare,
  Heart,
  ThumbsUp,
  Sparkles,
  Lightbulb,
  MessageCircle,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Space { id: string; name: string; type?: string | null; memberCount?: number; }
interface Post {
  id: string;
  content: string;
  createdAt: string;
  pollQuestion?: string | null;
  pollOptionsJson?: string | null;
  author?: { id: string; fullName: string; role: string; jobTitle?: string | null; avatarUrl?: string | null } | null;
  space?: { id: string; name: string } | null;
  comments?: Array<{ id: string; content: string; author?: { id: string; fullName: string; avatarUrl?: string | null } | null }>;
  reactions?: Array<{ id: string; emoji: string; userId?: string }>;
  _count?: { comments: number; reactions: number };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

const REACTIONS = [
  { emoji: "👍", label: "Me gusta", Icon: ThumbsUp },
  { emoji: "❤️", label: "Me encanta", Icon: Heart },
  { emoji: "🎉", label: "Celebro", Icon: Sparkles },
  { emoji: "💡", label: "Me ilumina", Icon: Lightbulb },
];

export function CommunityView() {
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<Post[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [composerSpace, setComposerSpace] = useState<string>("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = activeSpace && activeSpace !== "all" ? `&spaceId=${activeSpace}` : "";
    fetch(`/api/feed?institutionId=${user.institution.id}${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setPosts(d.posts);
          if (d.spaces) setSpaces(d.spaces);
        }
      })
      .finally(() => setLoading(false));
  }, [user, activeSpace]);

  async function submitPost() {
    if (!user) return;
    if (!composer.trim()) {
      toast.error("Escriba un contenido para publicar");
      return;
    }
    setPosting(true);
    const res = await fetch(`/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        authorId: user.id,
        spaceId: composerSpace || null,
        content: composer,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Publicación compartida en la comunidad");
      setComposer("");
      reload();
    } else {
      toast.error("No se pudo publicar");
    }
    setPosting(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-4 gap-4"
    >
      {/* Sidebar */}
      <aside className="lg:col-span-1 space-y-4">
        <Card className="hairline rounded-xl sticky top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Espacios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              Seleccione un espacio para filtrar el feed. Cada espacio es una comunidad temática con
              sus propios miembros y reglas de participación.
            </p>
            <SpaceRow
              name="Todos los espacios"
              count={posts.length}
              active={activeSpace === "all"}
              onClick={() => setActiveSpace("all")}
            />
            {spaces.map((s) => (
              <SpaceRow
                key={s.id}
                name={s.name}
                count={s.memberCount ?? 0}
                active={activeSpace === s.id}
                onClick={() => setActiveSpace(s.id)}
              />
            ))}
            {spaces.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">No hay espacios configurados.</p>
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Main */}
      <main className="lg:col-span-3 space-y-4">
        {/* Composer */}
        <Card className="hairline rounded-xl">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-xs">
                  {user?.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">{user?.fullName}</div>
                <div className="text-[11px] text-muted-foreground">Comparta algo con la comunidad…</div>
              </div>
            </div>
            <Textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={3}
              placeholder="Anuncios, reflexiones, preguntas o recursos para la comunidad educativa…"
            />
            <div className="flex items-center gap-3">
              <Select value={composerSpace} onValueChange={setComposerSpace}>
                <SelectTrigger className="w-52" size="sm">
                  <SelectValue placeholder="Espacio (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="ml-auto gap-1.5" onClick={submitPost} disabled={posting}>
                <Send className="h-4 w-4" /> Publicar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl skeleton-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="hairline rounded-xl">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="text-base font-medium">Aún no hay publicaciones</div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Sea la primera persona en compartir algo en este espacio. Anuncie un evento, abra un
                debate o publique un recurso útil para la comunidad.
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </main>
    </motion.div>
  );
}

function SpaceRow({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors",
        active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:bg-secondary"
      )}
    >
      <span className="truncate">{name}</span>
      <Badge variant="outline" className="text-[10px] tabular-nums">{count}</Badge>
    </button>
  );
}

function PostCard({ post }: { post: Post }) {
  const [showComments, setShowComments] = useState(false);
  const [reactions, setReactions] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    REACTIONS.forEach((r) => (map[r.emoji] = 0));
    post.reactions?.forEach((r) => {
      map[r.emoji] = (map[r.emoji] ?? 0) + 1;
    });
    return map;
  });

  function react(emoji: string) {
    setReactions((p) => ({ ...p, [emoji]: (p[emoji] ?? 0) + 1 }));
  }

  return (
    <Card className="hairline rounded-xl">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-secondary text-xs">
              {post.author?.fullName?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{post.author?.fullName ?? "Anónimo"}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{post.author?.role ?? "—"}</Badge>
              {post.space && <Badge variant="secondary" className="text-[10px]">{post.space.name}</Badge>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {relativeTime(post.createdAt)} · {post.author?.jobTitle ?? ""}
            </div>
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap">{post.content}</p>

        {/* Poll */}
        {post.pollQuestion && (
          <div className="hairline rounded-md p-3 bg-secondary/20">
            <div className="text-xs font-medium mb-2">📊 {post.pollQuestion}</div>
            {(() => {
              try {
                const opts: string[] = JSON.parse(post.pollOptionsJson || "[]");
                return opts.map((o, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-xs px-3 py-1.5 rounded-md hairline mb-1 hover:bg-secondary"
                    onClick={() => toast.success(`Voto registrado: ${o}`)}
                  >
                    {o}
                  </button>
                ));
              } catch {
                return null;
              }
            })()}
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {REACTIONS.map((r) => {
            const Icon = r.Icon;
            return (
              <button
                key={r.emoji}
                onClick={() => react(r.emoji)}
                className="flex items-center gap-1 px-2 py-1 rounded-md hairline text-xs hover:bg-secondary transition-colors"
                aria-label={r.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{reactions[r.emoji] ?? 0}</span>
              </button>
            );
          })}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={() => setShowComments((v) => !v)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments?.length ?? 0} comentarios
          </Button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="space-y-2 pt-2 hairline-t">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-secondary text-[10px]">
                      {c.author?.fullName?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-secondary/40 rounded-md px-3 py-1.5">
                    <div className="text-xs font-medium">{c.author?.fullName ?? "Anónimo"}</div>
                    <div className="text-sm">{c.content}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Aún no hay comentarios. Sea el primero en responder.
              </p>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("Use la app móvil para responder")}>
              <MessageCircle className="h-3.5 w-3.5" /> Responder
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
