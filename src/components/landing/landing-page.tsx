"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  GraduationCap,
  Users,
  Shield,
  BookOpen,
  HeartHandshake,
  Building2,
  Vote,
  FileText,
  ClipboardCheck,
  Bell,
  Star,
  Smartphone,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { Calendar, MessageSquare } from "lucide-react";

const MODULES = [
  // Académico
  { area: "Académico", name: "Planeador de clases", desc: "Clases por fases, evidencias, sugerencias pedagógicas automáticas.", icon: BookOpen },
  { area: "Académico", name: "Indicadores de desempeño", desc: "Integración automática en boletines según nivel del estudiante.", icon: ClipboardCheck },
  { area: "Académico", name: "Notas parciales", desc: "Planilla tipo hoja de cálculo, conectada con E-Learning y autoevaluación.", icon: FileText },
  { area: "Académico", name: "Pre-Informe", desc: "Detección temprana de estudiantes en riesgo antes del cierre de periodo.", icon: Bell },
  { area: "Académico", name: "Banco de talleres", desc: "Reutilización y asignación de talleres, útil en ausencias docentes.", icon: BookOpen },
  { area: "Académico", name: "E-Learning", desc: "Contenidos y actividades virtuales para estudio desde casa.", icon: GraduationCap },
  { area: "Académico", name: "Autoevaluación", desc: "Criterios institucionales; la nota se consolida en la planilla del docente.", icon: Star },
  { area: "Académico", name: "Supervisión académica", desc: "Vista consolidada para directivos sobre avance y resultados docentes.", icon: ClipboardCheck },
  // Convivencia
  { area: "Convivencia", name: "Control de asistencia", desc: "Notificación en tiempo real al acudiente (inasistencias, llegadas tarde).", icon: Bell },
  { area: "Convivencia", name: "Dirección de grupo", desc: "Información personal, cumpleaños, contacto, datos académicos y de convivencia.", icon: Users },
  { area: "Convivencia", name: "Ficha del observador", desc: "Registro periódico comportamental del estudiante.", icon: FileText },
  { area: "Convivencia", name: "Convivencia escolar", desc: "Situaciones Tipo I, II y III con descargos del estudiante.", icon: Shield },
  { area: "Convivencia", name: "Orientación escolar", desc: "Atenciones individuales y grupales, remisiones y seguimiento.", icon: HeartHandshake },
  { area: "Convivencia", name: "Notas para acudientes", desc: "Calificación periódica del director de grupo al acudiente, reflejada en boletín.", icon: Star },
  { area: "Convivencia", name: "Comunicación SMS", desc: "Notificaciones instantáneas a acudientes: asistencia, eventos, alertas.", icon: Bell },
  // Comunidad
  { area: "Comunidad", name: "Gobierno escolar", desc: "Votaciones ágiles y seguras, resultados en tiempo real.", icon: Vote },
  { area: "Comunidad", name: "Inscripción en línea", desc: "Solicitud de cupo por acudientes, sincronizable con el sistema.", icon: FileText },
  { area: "Comunidad", name: "Pre-Matrícula", desc: "Reserva de cupo para el año siguiente en línea.", icon: Users },
  { area: "Comunidad", name: "Spaces institucionales", desc: "Por grado, área, comité, grupo de acudientes o proyecto.", icon: Users },
  { area: "Comunidad", name: "Feed y mensajería", desc: "Publicaciones, comentarios anidados, menciones @, mensajería directa.", icon: MessageSquare },
  // Administración
  { area: "Administración", name: "Libros reglamentarios", desc: "Matrícula, calificaciones, observador y convivencia digitalizados.", icon: BookOpen },
  { area: "Administración", name: "Actas institucionales", desc: "Generación, firma y archivo con respaldo legal y sello temporal.", icon: FileText },
  { area: "Administración", name: "Matrícula", desc: "Gestión en línea, carga de documentos y trazabilidad completa.", icon: ClipboardCheck },
  { area: "Administración", name: "Asignación académica", desc: "Docentes a grupos y asignaturas; base estructural para boletines.", icon: Building2 },
  { area: "Administración", name: "Periodos académicos", desc: "Cortes evaluativos y porcentajes; activación de módulos de notas.", icon: Calendar },
  { area: "Administración", name: "Configuración del sistema", desc: "Grupos, escalas, roles y variables personalizables sin soporte.", icon: Shield },
  { area: "Administración", name: "Talento Humano", desc: "Hojas de vida del personal docente y administrativo.", icon: Users },
  { area: "Administración", name: "Auditoría", desc: "Registro de acciones importantes con firma, IP y hash.", icon: Shield },
];

const AREAS = ["Todos", "Académico", "Convivencia", "Comunidad", "Administración"] as const;

const PRICING = [
  { range: "Hasta 100 estudiantes", monthly: 220000, annual: 2200000, features: ["Todos los módulos", "Comunidad escolar", "Soporte por correo", "1 institución"] },
  { range: "Hasta 300 estudiantes", monthly: 580000, annual: 5800000, features: ["Todo lo anterior", "SMS incluido (500/mes)", "Soporte prioritario", "Capacitación inicial"] },
  { range: "Hasta 800 estudiantes", monthly: 1450000, annual: 14500000, features: ["Todo lo anterior", "SMS ilimitado", "SSO por dominio", "Acompañamiento mensual"] },
  { range: "1500+ estudiantes", monthly: 2600000, annual: 26000000, features: ["Todo lo anterior", "Múltiples sedes", "SLA 99.5%", "Gerente de cuenta dedicado"] },
];

const CASES = [
  { institution: "IE La Salle — Medellín", quote: "Las actas firmadas con sello criptográfico nos salvaron en la visita de supervisión. Trazabilidad total.", author: "Hermana Lucía R.", role: "Rectora" },
  { institution: "Colegio Campestre del Bosque", quote: "El pre-informe nos permitió intervenir a tiempo a 14 estudiantes en riesgo. Pasamos de reactivos a preventivos.", author: "Carlos A. Gómez", role: "Coordinador" },
  { institution: "IE Técnico Industrial — Cali", quote: "El módulo de convivencia con descargos del estudiante trajo paz jurídica al proceso. Las familias lo agradecen.", author: "Diana M. Quintero", role: "Orientadora" },
];

export function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [activeArea, setActiveArea] = useState<(typeof AREAS)[number]>("Todos");
  const setDemoSheet = useUIStore((s) => s.setDemoSheet);
  const reduce = useReducedMotion();

  const filteredModules =
    activeArea === "Todos"
      ? MODULES
      : MODULES.filter((m) => m.area === activeArea);

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader onLogin={onLogin} />
      <main className="flex-1">
        <Hero onLogin={onLogin} />
        <ModulesCatalog
          activeArea={activeArea}
          setActiveArea={setActiveArea}
          modules={filteredModules}
        />
        <PricingSection />
        <PersonalizationSection />
        <CasesSection />
        <CommunitySection />
        <DemoSection onDemo={() => setDemoSheet(true)} />
      </main>
      <LandingFooter />
    </div>
  );
}

function LandingHeader({ onLogin }: { onLogin: () => void }) {
  return (
    <header className="sticky top-0 z-40 hairline-b bg-[var(--app-card)]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-heading font-semibold text-sm">
            Au
          </div>
          <div>
            <div className="font-heading font-semibold leading-none">Aulnea</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Plataforma educativa
            </div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#modulos" className="text-muted-foreground hover:text-foreground transition-colors">
            Módulos
          </a>
          <a href="#precio" className="text-muted-foreground hover:text-foreground transition-colors">
            Para instituciones
          </a>
          <a href="#comunidad" className="text-muted-foreground hover:text-foreground transition-colors">
            Comunidad
          </a>
          <a href="#casos" className="text-muted-foreground hover:text-foreground transition-colors">
            Casos
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <Button size="sm" onClick={onLogin} className="gap-1.5">
            Ingresar
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onLogin }: { onLogin: () => void }) {
  const reduce = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduce) return;
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: py * -12, y: px * 12 });
    },
    [reduce]
  );

  return (
    <section className="relative overflow-hidden hairline-b">
      <div className="absolute inset-0 -z-10 opacity-[0.04]" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--app-fg) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="outline" className="mb-5 hairline">
            <Sparkles className="h-3 w-3 mr-1.5 text-brass" />
            Plataforma modular educativa
          </Badge>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
            La institución escolar,{" "}
            <span className="text-primary">desde un solo lugar.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
            Gestión académica, administrativa, comunicación y reportes con respaldo legal.
            Modular, intuitiva y trazable. PWA instalable que funciona offline y notifica
            a las familias en tiempo real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onLogin} className="gap-2">
              Acceder al panel
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="hairline gap-2" asChild>
              <a href="#modulos">
                Ver módulos
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            <Stat value="28" label="Módulos" />
            <Stat value="8" label="Roles" />
            <Stat value="3" label="Temas" />
          </div>
        </div>
        <div
          onMouseMove={handleMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          className="relative"
        >
          <motion.div
            animate={{ rotateX: tilt.x, rotateY: tilt.y }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{ transformPerspective: 1000 }}
            className="parallax-hero relative aspect-[4/3] rounded-xl hairline overflow-hidden bg-[var(--app-card)]"
          >
            <HeroIllustration />
          </motion.div>
          <div className="absolute -bottom-4 -right-2 sm:right-6 max-w-[260px]">
            <Card className="hairline shadow-md">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full chip-basico grid place-items-center flex-shrink-0">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">3 estudiantes en riesgo</div>
                    <div className="text-muted-foreground mt-0.5">
                      en 8°B antes del cierre del periodo 2
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 600 450"
      className="w-full h-full"
      role="img"
      aria-label="Estudiantes y docente colaborando alrededor de una tableta en un aula contemporánea"
    >
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--app-secondary)" />
          <stop offset="100%" stopColor="var(--app-bg)" />
        </linearGradient>
        <linearGradient id="heroAccent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--app-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--app-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="600" height="450" fill="url(#heroBg)" />
      <rect x="0" y="0" width="600" height="180" fill="url(#heroAccent)" />
      {/* Pizarra */}
      <rect x="60" y="60" width="280" height="120" rx="8" fill="var(--app-sidebar)" stroke="var(--app-border)" />
      <text x="200" y="100" textAnchor="middle" fontFamily="var(--app-font-heading)" fontSize="13" fill="var(--app-muted-fg)">
        Periodo 2 · 8°A
      </text>
      <text x="200" y="125" textAnchor="middle" fontFamily="var(--app-font-heading)" fontSize="20" fontWeight="600" fill="var(--app-fg)">
        Matemáticas
      </text>
      <text x="200" y="150" textAnchor="middle" fontFamily="var(--app-font-body)" fontSize="11" fill="var(--app-muted-fg)">
        Funciones lineales · Taller 4
      </text>
      {/* Mesa */}
      <path d="M 120 280 L 480 280 L 460 380 L 140 380 Z" fill="var(--app-card)" stroke="var(--app-border)" />
      {/* Tableta */}
      <rect x="220" y="270" width="160" height="100" rx="10" fill="var(--app-primary)" />
      <rect x="230" y="280" width="140" height="80" rx="4" fill="var(--app-primary-fg)" opacity="0.95" />
      <circle cx="260" cy="305" r="8" fill="var(--perf-superior)" />
      <circle cx="290" cy="305" r="8" fill="var(--perf-alto)" />
      <circle cx="320" cy="305" r="8" fill="var(--perf-basico)" />
      <rect x="240" y="325" width="120" height="6" rx="3" fill="var(--app-primary)" opacity="0.25" />
      <rect x="240" y="338" width="90" height="6" rx="3" fill="var(--app-primary)" opacity="0.18" />
      {/* Personas */}
      {/* Docente */}
      <g>
        <circle cx="100" cy="240" r="22" fill="#C9A979" />
        <rect x="78" y="260" width="44" height="60" rx="8" fill="var(--app-brass)" />
        <rect x="88" y="270" width="24" height="20" fill="var(--app-card)" opacity="0.3" />
      </g>
      {/* Estudiante 1 */}
      <g>
        <circle cx="440" cy="245" r="18" fill="#9C7F55" />
        <rect x="422" y="263" width="36" height="50" rx="6" fill="var(--app-secondary-fg)" opacity="0.7" />
      </g>
      {/* Estudiante 2 */}
      <g>
        <circle cx="500" cy="250" r="18" fill="#B89472" />
        <rect x="482" y="268" width="36" height="50" rx="6" fill="var(--app-secondary-fg)" opacity="0.6" />
      </g>
      {/* Líneas decorativas */}
      <line x1="60" y1="410" x2="540" y2="410" stroke="var(--app-border)" strokeWidth="1" />
      <text x="60" y="430" fontFamily="var(--app-font-body)" fontSize="10" fill="var(--app-muted-fg)">
        Aula contemporánea · Colaboración
      </text>
    </svg>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-heading text-3xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

function ModulesCatalog({
  activeArea,
  setActiveArea,
  modules,
}: {
  activeArea: (typeof AREAS)[number];
  setActiveArea: (a: (typeof AREAS)[number]) => void;
  modules: typeof MODULES;
}) {
  return (
    <section id="modulos" className="py-16 md:py-24 hairline-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3 hairline">
            Catálogo navegable
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Módulos que trabajan juntos.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            Filtra por área. Cada módulo está diseñado como herramienta de trabajo diario,
            no como demo. Las etiquetas emiten glow al pasar y los módulos se reordenan
            con transición de 350 ms.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist">
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => setActiveArea(a)}
              role="tab"
              aria-selected={activeArea === a}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hairline",
                activeArea === a
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              {a}
            </button>
          ))}
        </div>

        <motion.div layout className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                layout
                key={m.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className="module-glow h-full hairline rounded-lg overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-9 w-9 rounded-md bg-secondary grid place-items-center text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider hairline">
                        {m.area}
                      </Badge>
                    </div>
                    <h3 className="font-heading font-semibold text-base mb-1.5">
                      {m.name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {m.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [students, setStudents] = useState(300);
  const [annual, setAnnual] = useState(false);

  // Encontrar el tier más cercano
  const tier = PRICING.reduce((closest, t) => {
    const range = parseInt(t.range.match(/\d+/)?.[0] || "0");
    const closestRange = parseInt(closest.range.match(/\d+/)?.[0] || "0");
    if (students <= range && (students <= closestRange || students > closestRange)) {
      return students <= closestRange ? t : closest;
    }
    return closest;
  }, PRICING[PRICING.length - 1]);

  const actualTier =
    students <= 100 ? PRICING[0] :
    students <= 300 ? PRICING[1] :
    students <= 800 ? PRICING[2] :
    PRICING[3];

  const price = annual ? actualTier.annual : actualTier.monthly;

  return (
    <section id="precio" className="py-16 md:py-24 hairline-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3 hairline">
            Para instituciones
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Precio por matrícula. Sin sorpresas.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Mueva el slider para estimar el costo mensual o anual. Todos los planes incluyen
            todos los módulos.
          </p>
        </div>

        <div className="mt-10 grid lg:grid-cols-[1fr_2fr] gap-8">
          <Card className="hairline p-6 lg:sticky lg:top-24 h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Estudiantes</span>
              <span className="font-heading font-semibold text-2xl">{students}</span>
            </div>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={students}
              onChange={(e) => setStudents(Number(e.target.value))}
              className="w-full mt-2 accent-[var(--app-primary)]"
              aria-label="Número de estudiantes"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>50</span>
              <span>500</span>
              <span>1000</span>
              <span>2000</span>
            </div>
            <div className="mt-6 pt-6 hairline-t">
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-4xl font-semibold tabular-nums">
                  ${price.toLocaleString("es-CO")}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{annual ? "año" : "mes"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{actualTier.range}</div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant={!annual ? "default" : "outline"}
                  className="flex-1 hairline"
                  onClick={() => setAnnual(false)}
                >
                  Mensual
                </Button>
                <Button
                  size="sm"
                  variant={annual ? "default" : "outline"}
                  className="flex-1 hairline"
                  onClick={() => setAnnual(true)}
                >
                  Anual (-17%)
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            {PRICING.map((p, i) => {
              const isActive = p === actualTier;
              return (
                <Card
                  key={i}
                  className={cn(
                    "hairline p-5 transition-all duration-300",
                    isActive && "ring-2 ring-primary"
                  )}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.range}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-heading text-2xl font-semibold">
                      ${p.monthly.toLocaleString("es-CO")}
                    </span>
                    <span className="text-xs text-muted-foreground">/mes</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonalizationSection() {
  return (
    <section className="py-16 md:py-24 hairline-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="outline" className="mb-3 hairline">
            Personalización
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Su escudo, su propuesta institucional.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            El constructor superpone el escudo o logo del colegio sobre la portada
            institucional y exporta a PDF. Cada institución tiene su identidad sobre una
            base cromática sobria.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Logo / escudo sobre plantilla institucional",
              "Colores primarios de la institución (con validación AA)",
              "Firma digital de rectoría en cada acta",
              "Exportación a PDF con sello temporal",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <Card className="hairline aspect-[3/4] max-w-sm mx-auto relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />
            <div className="p-8 h-full flex flex-col">
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-primary text-primary-foreground grid place-items-center mb-4">
                    <GraduationCap className="h-10 w-10" />
                  </div>
                  <div className="font-heading text-xl font-semibold">
                    Institución Educativa
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Proyecto educativo institucional 2025
                  </div>
                </div>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                <div>Aulnea · Documento institucional</div>
                <div className="mt-1 font-mono text-[10px] opacity-60">
                  hash: a3f4...8b9c
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function CasesSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="casos" className="py-16 md:py-24 hairline-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3 hairline">
            Casos de éxito
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Lo que dicen las instituciones.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Haga clic en una tarjeta para leer la cita completa.
          </p>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {CASES.map((c, i) => {
            const isOpen = open === i;
            return (
              <Card
                key={i}
                className={cn(
                  "hairline cursor-pointer transition-all duration-300 overflow-hidden",
                  isOpen ? "md:row-span-2 md:col-span-1" : ""
                )}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      viewBox="0 0 24 24"
                      className={cn(
                        "draw-quote h-6 w-6 text-primary",
                        isOpen && "draw-quote-active"
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 21c3 0 7-1 7-8V5c0-1-1-2-2-2H4c-1 0-2 1-2 2v6c0 1 1 2 2 2h3" />
                      <path d="M14 21c3 0 7-1 7-8V5c0-1-1-2-2-2h-4c-1 0-2 1-2 2v6c0 1 1 2 2 2h3" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {c.institution}
                    </span>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{
                      height: isOpen ? "auto" : "auto",
                      opacity: 1,
                    }}
                    className="overflow-hidden"
                  >
                    <p
                      className={cn(
                        "font-heading italic leading-relaxed transition-all",
                        isOpen ? "text-base" : "text-sm line-clamp-2"
                      )}
                    >
                      "{c.quote}"
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-xs font-semibold">
                        {c.author.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-medium">{c.author}</div>
                        <div className="text-xs text-muted-foreground">{c.role}</div>
                      </div>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CommunitySection() {
  return (
    <section id="comunidad" className="py-16 md:py-24 hairline-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1">
          <Card className="hairline overflow-hidden">
            <CardContent className="p-0">
              <div className="hairline-b p-4 bg-secondary/30">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium">Docentes — Generales</span>
                  <span className="text-xs text-muted-foreground ml-auto">42 miembros</span>
                </div>
              </div>
              <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                <Post author="Gloria Inés Restrepo" role="Rectora" time="hace 2h" pinned>
                  Recordatorio: el cierre del Periodo 2 es el próximo viernes. Todos los
                  docentes deben subir notas antes de las 5pm.
                </Post>
                <Post author="Carlos Gómez" role="Coordinador" time="hace 4h">
                  Comparto el formato actualizado del pre-informe para estudiantes en riesgo.
                  @docente @director Identifiquemos temprano.
                </Post>
                <Post author="María Torres" role="Director 8°A" time="hace 1d">
                  Acudientes del 8°A: mañana sesión de orientación grupal a las 2pm.
                  Tema: hábitos de estudio.
                </Post>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="order-1 lg:order-2">
          <Badge variant="outline" className="mb-3 hairline">
            Capa de comunidad
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Comunidad escolar, no solo gestión.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            Inspirada en FluentCommunity. Spaces por grado, área, comité o proyecto.
            Feed con menciones, reacciones y encuestas. Mensajería directa. Notificaciones
            multi-canal. Gamificación con insignias.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: "Spaces institucionales" },
              { icon: MessageSquare, label: "Feed y mensajería" },
              { icon: Bell, label: "Notificaciones multi-canal" },
              { icon: Star, label: "Insignias y méritos" },
              { icon: Vote, label: "Gobierno escolar en vivo" },
              { icon: Shield, label: "Moderación y reportes" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center text-primary flex-shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Post({
  author,
  role,
  time,
  pinned,
  children,
}: {
  author: string;
  role: string;
  time: string;
  pinned?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-xs font-semibold flex-shrink-0">
        {author.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{author}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
          {pinned && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 hairline">
              Fijado
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{time}</span>
        </div>
        <p className="text-sm mt-1 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function DemoSection({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="py-16 md:py-24 hairline-b">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <Badge variant="outline" className="mb-3 hairline">
          <Smartphone className="h-3 w-3 mr-1.5" />
          PWA instalable
        </Badge>
        <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
          Solicite una demostración.
        </h2>
        <p className="mt-4 text-muted-foreground text-lg">
          Confirmación lateral, firme y sin rebote. Le contactamos en menos de 24 horas
          hábiles con un ambiente de prueba configurado para su institución.
        </p>
        <div className="mt-8">
          <Button size="lg" onClick={onDemo} className="gap-2">
            Solicitar demo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-left">
          {[
            { icon: Shield, t: "Legalmente respaldada", d: "Trazabilidad, actas y libros reglamentarios." },
            { icon: Smartphone, t: "Funciona offline", d: "Planeador, notas y observador offline-first." },
            { icon: Bell, t: "Push en tiempo real", d: "Inasistencias, menciones, cierre de periodo." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.t} className="hairline rounded-lg p-4">
                <Icon className="h-5 w-5 text-primary mb-2" />
                <div className="font-medium text-sm">{f.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-[var(--app-card)] hairline-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-heading font-semibold text-xs">
                Au
              </div>
              <span className="font-heading font-semibold">Aulnea</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plataforma educativa modular, intuitiva y legalmente respaldada.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Producto
            </div>
            <ul className="space-y-2 text-sm">
              <li><a href="#modulos" className="hover:text-primary">Módulos</a></li>
              <li><a href="#precio" className="hover:text-primary">Para instituciones</a></li>
              <li><a href="#comunidad" className="hover:text-primary">Comunidad</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Cumplimiento
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Ley 1581 de 2012 (Colombia)</li>
              <li>GDPR</li>
              <li>Habeas data de menores</li>
              <li>WCAG AA</li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Tecnología
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Next.js · TypeScript</li>
              <li>PWA · Offline-first</li>
              <li>Multi-tenant</li>
              <li>Código abierto</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 hairline-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Aulnea. MIT License.</div>
          <div className="flex items-center gap-4">
            <span>Hecho con intención institucional.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
