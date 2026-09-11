"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  BookOpen,
  PlayCircle,
  FileText,
  GraduationCap,
  ClipboardCheck,
  Plus,
  Star,
  Lightbulb,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  fullName: string;
  role: string;
  jobTitle?: string | null;
  email?: string | null;
}

interface Phase {
  objective: string;
  activities: string[];
  resources: string[];
  evidences: string[];
}

const INITIAL_PHASES: Record<string, Phase> = {
  Inicio: {
    objective: "Activar conocimientos previos y plantear el objetivo de la clase.",
    activities: [
      "Lluvia de ideas sobre el tema",
      "Presentación del objetivo en pantalla",
    ],
    resources: ["Proyector", "Pizarra digital"],
    evidences: ["Diagnóstico escrito", "Registro de participaciones"],
  },
  Desarrollo: {
    objective: "Construir el nuevo conocimiento mediante actividad guiada.",
    activities: [
      "Explicación con ejemplo modelado",
      "Trabajo colaborativo en parejas",
      "Plenaria de socialización",
    ],
    resources: ["Taller impreso", "Calculadora"],
    evidences: ["Taller resuelto", "Rúbrica de evaluación"],
  },
  Cierre: {
    objective: "Consolidar el aprendizaje y evaluar el alcance del objetivo.",
    activities: [
      "Síntesis en mapas conceptuales",
      "Autoevaluación rápida",
    ],
    resources: ["Plantilla de mapa conceptual"],
    evidences: ["Mapa conceptual final", "Bitácora de autoevaluación"],
  },
};

const ELEARNING_CARDS = [
  { id: "1", title: "Funciones y gráficas", type: "video", duration: 18, desc: "Video clase magistral sobre funciones lineales y cuadráticas con ejemplos prácticos." },
  { id: "2", title: "Taller de ecuaciones", type: "taller", duration: 45, desc: "Ejercicios progresivos con retroalimentación automática para reforzar ecuaciones." },
  { id: "3", title: "Lectura: mitología griega", type: "lectura", duration: 30, desc: "Antología comentada con preguntas de comprensión lectora y análisis literario." },
  { id: "4", title: "Circuitos eléctricos", type: "video", duration: 22, desc: "Simulación interactiva de circuitos en serie y paralelo con guía paso a paso." },
  { id: "5", title: "Taller de fotosíntesis", type: "taller", duration: 35, desc: "Laboratorio virtual sobre el proceso de fotosíntesis con reporte guiado." },
  { id: "6", title: "Lectura: independencia", type: "lectura", duration: 25, desc: "Documentos históricos con preguntas de análisis crítico y línea de tiempo." },
];

const TYPE_ICON: Record<string, any> = {
  video: PlayCircle,
  taller: ClipboardCheck,
  lectura: FileText,
};

const CRITERIA = [
  { key: "cumplimiento", label: "Cumplimiento" },
  { key: "participacion", label: "Participación" },
  { key: "honestidad", label: "Honestidad" },
  { key: "trabajo_equipo", label: "Trabajo en equipo" },
  { key: "autogestion", label: "Auto-gestión" },
];

export function PlannerView({ module }: { module: "planeador" | "e-learning" | "autoevaluacion" | "supervision" }) {
  if (module === "planeador") return <PlaneadorView />;
  if (module === "e-learning") return <ELearningView />;
  if (module === "autoevaluacion") return <AutoevaluacionView />;
  return <SupervisionViewImpl />;
}

function PlaneadorView() {
  const user = useAuthStore((s) => s.user);
  const [phases, setPhases] = useState<Record<string, Phase>>(INITIAL_PHASES);
  const [subject, setSubject] = useState("Matemáticas");
  const [newItem, setNewItem] = useState<Record<string, { field: "activities" | "resources" | "evidences"; value: string }>>({});

  function addItem(phase: string, field: "activities" | "resources" | "evidences", value: string) {
    if (!value.trim()) return;
    setPhases((prev) => ({
      ...prev,
      [phase]: { ...prev[phase], [field]: [...prev[phase][field], value] },
    }));
    setNewItem((p) => ({ ...p, [phase]: { field, value: "" } }));
    toast.success("Ítem añadido a la planeación");
  }

  const tips = [
    `Para ${subject}: inicie con una pregunta abierta que conecte con la cotidianidad del estudiante.`,
    "Varíe estrategias: combine exposición, trabajo colaborativo y reflexión individual.",
    "Dedique al cierre entre 10 y 15 minutos para consolidar y verificar el objetivo.",
    "Incluya al menos una evidencia observable que permita retroalimentar el aprendizaje.",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">
            Planeador de clases
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Planee sus clases en tres fases pedagógicas (Inicio, Desarrollo, Cierre). Cada fase
            admite objetivo, actividades, recursos y evidencias. Las sugerencias laterales se
            adaptan a la asignatura seleccionada y le ayudan a aplicar principios pedagógicos
            probados en su planificación diaria.
          </p>
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Matemáticas">Matemáticas</SelectItem>
            <SelectItem value="Lenguaje">Lenguaje</SelectItem>
            <SelectItem value="Ciencias">Ciencias Naturales</SelectItem>
            <SelectItem value="Sociales">Ciencias Sociales</SelectItem>
            <SelectItem value="Inglés">Inglés</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(phases).map(([name, phase]) => (
            <Card key={name} className="hairline rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" /> {name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Objetivo</Label>
                  <p className="text-xs mt-1 hairline rounded-md p-2 bg-secondary/30">{phase.objective}</p>
                </div>
                <PhaseList
                  title="Actividades"
                  items={phase.activities}
                  onAdd={(v) => addItem(name, "activities", v)}
                />
                <PhaseList
                  title="Recursos"
                  items={phase.resources}
                  onAdd={(v) => addItem(name, "resources", v)}
                />
                <PhaseList
                  title="Evidencias"
                  items={phase.evidences}
                  onAdd={(v) => addItem(name, "evidences", v)}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="lg:col-span-1">
          <Card className="hairline rounded-xl sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-[var(--app-warning)]" /> Sugerencias pedagógicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tips.map((t, i) => (
                <div key={i} className="text-xs hairline rounded-md p-2.5 bg-secondary/30">
                  <span className="text-primary font-medium">Tip {i + 1}.</span> {t}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </motion.div>
  );
}

function PhaseList({
  title,
  items,
  onAdd,
}: {
  title: string;
  items: string[];
  onAdd: (v: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground">{title}</Label>
      <ul className="space-y-1 mt-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs flex items-start gap-1.5 hairline rounded-md px-2 py-1 bg-secondary/20">
            <span className="text-primary">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Añadir ${title.toLowerCase().slice(0, -1)}…`}
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAdd(value);
              setValue("");
            }
          }}
        />
        <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" aria-label="Añadir" onClick={() => { onAdd(value); setValue(""); }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ELearningView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" /> E-Learning
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Biblioteca de contenidos virtuales: videos clase, talleres interactivos y lecturas
          guiadas. Cada recurso está clasificado por tipo y duración. Use el botón "Acceder" para
          abrir el contenido en el reproductor integrado y registrar el avance del estudiante.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ELEARNING_CARDS.map((c) => {
          const Icon = TYPE_ICON[c.type] ?? FileText;
          return (
            <Card key={c.id} className="hairline rounded-xl flex flex-col">
              <CardContent className="py-4 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{c.type}</Badge>
                </div>
                <div>
                  <div className="text-base font-semibold leading-tight">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.duration} min</div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{c.desc}</p>
                <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => toast.success(`Abriendo "${c.title}"…`)}>
                  <PlayCircle className="h-3.5 w-3.5" /> Acceder
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}

function AutoevaluacionView() {
  const user = useAuthStore((s) => s.user);
  const [scores, setScores] = useState<Record<string, number>>({
    cumplimiento: 3,
    participacion: 3,
    honestidad: 3,
    trabajo_equipo: 3,
    autogestion: 3,
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    const value = Math.round((avg / 5) * 100);
    try {
      const res = await fetch(`/api/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: user.institution.id,
          studentId: user.id,
          subjectId: "self-eval",
          periodId: "current",
          teacherId: user.id,
          userId: user.id,
          value,
          performance: value >= 90 ? "superior" : value >= 75 ? "alto" : value >= 60 ? "basico" : "bajo",
          observations: `Autoevaluación: ${JSON.stringify(scores)}`,
          isSelfEval: true,
        }),
      });
      const d = await res.json();
      if (d.ok) toast.success("Autoevaluación registrada");
      else toast.error("No se pudo registrar la autoevaluación");
    } catch {
      toast.error("Error de red");
    }
    setSubmitting(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <Star className="h-6 w-6 text-[var(--app-warning)]" /> Autoevaluación
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Reflexione sobre su desempeño en cinco criterios fundamentales. Mueva los controles
          deslizantes para asignar una puntuación entre 1 y 5. Al enviar, el sistema calcula un
          promedio ponderado y lo registra como nota de autoevaluación en su historial académico.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Criterios de autoevaluación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {CRITERIA.map((c) => (
            <div key={c.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{c.label}</Label>
                <Badge variant="secondary" className="tabular-nums">{scores[c.key]} / 5</Badge>
              </div>
              <Slider
                value={[scores[c.key]]}
                min={1}
                max={5}
                step={1}
                onValueChange={(v) => setScores((p) => ({ ...p, [c.key]: v[0] }))}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1 — En desarrollo</span>
                <span>3 — Satisfactorio</span>
                <span>5 — Destacado</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between hairline-t pt-4">
            <div className="text-sm">
              Promedio:{" "}
              <span className="font-semibold tabular-nums">
                {(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length).toFixed(1)} / 5
              </span>
            </div>
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              <Star className="h-4 w-4" /> {submitting ? "Enviando…" : "Enviar autoevaluación"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SupervisionViewImpl() {
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/members?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMembers(d.members.filter((m: Member) => m.role === "docente"));
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Simulated aggregated data per teacher
  const rows = members.map((m, i) => ({
    ...m,
    subjects: ["Matemáticas", "Física"].slice(0, (i % 2) + 1),
    groups: ["8°A", "9°B"].slice(0, (i % 2) + 1),
    students: 60 + (i * 7) % 30,
    avg: 70 + (i * 3) % 20,
    riskPct: (i * 5) % 30,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Supervisión académica
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Panel de seguimiento al desempeño docente: asignaturas a cargo, grupos asignados, número
          de estudiantes, promedio académico y porcentaje de estudiantes en riesgo. Use esta
          información para orientar acompañamientos pedagógicos y reconocer buenas prácticas.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Cuadro de docentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin docentes</div>
              <p className="text-xs text-muted-foreground">No hay docentes registrados en la institución.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Docente</TableHead>
                  <TableHead>Asignaturas</TableHead>
                  <TableHead>Grupos</TableHead>
                  <TableHead className="text-right">Estudiantes</TableHead>
                  <TableHead className="text-right">Promedio</TableHead>
                  <TableHead className="text-right">% En riesgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{r.fullName}</div>
                      <div className="text-[11px] text-muted-foreground">{r.jobTitle ?? r.role}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.subjects.join(", ")}</TableCell>
                    <TableCell className="text-xs">{r.groups.join(", ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.students}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums", r.avg >= 80 ? "chip-superior" : r.avg >= 70 ? "chip-alto" : "chip-basico")}>
                        {r.avg}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums", r.riskPct > 20 ? "chip-bajo" : r.riskPct > 10 ? "chip-basico" : "chip-superior")}>
                        {r.riskPct}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
