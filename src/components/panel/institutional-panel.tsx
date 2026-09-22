"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore, type ModuleKey } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Bell,
  Library,
  GraduationCap,
  Star,
  ClipboardCheck,
  Users,
  Shield,
  HeartHandshake,
  Vote,
  Building2,
  Calendar,
  Settings,
  ScrollText,
  MessageSquare,
  Smartphone,
  LogOut,
  ChevronRight,
  ChevronDown,
  Boxes,
  CheckCircle,
  Wand2,
  Scale,
  MapPin,
  Clock,
  Variable,
  ListTree,
  UserCog,
  ClipboardList,
  School,
  ListChecks,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DashboardView } from "./views/dashboard-view";
import { GradesView } from "./views/grades-view";
import { ActivitiesManagementView } from "./views/grades/activities-management-view";
import { AttendanceView } from "./views/attendance-view";
import { ObserverView } from "./views/observer-view";
import { CoexistenceView } from "./views/coexistence-view";
import { CommunityView } from "./views/community-view";
import { MeetingsView } from "./views/meetings-view";
import { AuditView } from "./views/audit-view";
import { StudentsView } from "./views/students-view";
import { WorkshopsView } from "./views/workshops-view";
import { OrientationsView } from "./views/orientations-view";
import { EnrollmentsView } from "./views/enrollments-view";
import { PreInformeView } from "./views/pre-informe-view";
import { PlannerView } from "./views/planner-view";
import { SupervisionView } from "./views/supervision-view";
import { GroupDirectionView } from "./views/group-direction-view";
import { MessagesView } from "./views/messages-view";
import { AcademicoView } from "./views/academico-view";
import { ThemeOptionsView } from "./views/theme-options-view";
import { CustomModuleBuilderView } from "./views/custom-module-builder-view";
import { CustomModuleRuntimeView } from "./views/custom-module-runtime-view";
import { ModuleApprovalsView } from "./views/module-approvals-view";
import { ParamsView } from "./views/params-view";
import { UsersView } from "./views/users-view";
import { GroupsView } from "./views/groups-view";
import { ConceptsListView } from "./views/evaluative-concepts/concepts-list-view";
import { ModelsListView } from "./views/educational-models/models-list-view";
import { StudentsListView } from "./views/students/students-list-view";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isCustomModule, getCustomModuleId, customModuleKey } from "@/store/ui-store";
import { useEffect, useState } from "react";

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: any;
  roles?: string[]; // si no se especifica, todos
  group: string;
  hidden?: boolean; // deprecado: se oculta del menú sin borrar la clave ni la vista
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Inicio", icon: LayoutDashboard, group: "General" },

  // Académico
  { key: "planeador", label: "Planeador de clases", icon: BookOpen, group: "Académico", roles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "notas", label: "Notas parciales", icon: FileText, group: "Académico", roles: ["docente", "director_grupo", "coordinador", "rector"] },
  // [F3] Gestión de Actividades — junto a Notas parciales (decisión del usuario)
  { key: "gestion-actividades", label: "Gestión de Actividades", icon: ListChecks, group: "Académico", roles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "pre-informe", label: "Pre-Informe", icon: Bell, group: "Académico", roles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "talleres", label: "Banco de talleres", icon: Library, group: "Académico", roles: ["docente", "director_grupo", "coordinador"] },
  { key: "e-learning", label: "E-Learning", icon: GraduationCap, group: "Académico", roles: ["docente", "estudiante", "acudiente"] },
  { key: "autoevaluacion", label: "Autoevaluación", icon: Star, group: "Académico", roles: ["docente", "estudiante"] },
  { key: "supervision", label: "Supervisión académica", icon: ClipboardCheck, group: "Académico", roles: ["coordinador", "rector"] },
  { key: "indicadores", label: "Indicadores de desempeño", icon: ClipboardCheck, group: "Académico", roles: ["docente", "coordinador", "rector"] },

  // Convivencia
  { key: "asistencia", label: "Control de asistencia", icon: Bell, group: "Convivencia", roles: ["docente", "director_grupo", "coordinador", "acudiente"] },
  { key: "direccion-grupo", label: "Dirección de grupo", icon: Users, group: "Convivencia", roles: ["director_grupo", "coordinador"] },
  { key: "observador", label: "Ficha del observador", icon: FileText, group: "Convivencia", roles: ["docente", "director_grupo", "orientador", "coordinador", "rector"] },
  { key: "convivencia", label: "Convivencia escolar", icon: Shield, group: "Convivencia", roles: ["director_grupo", "orientador", "coordinador", "rector"] },
  { key: "orientacion", label: "Orientación escolar", icon: HeartHandshake, group: "Convivencia", roles: ["orientador", "coordinador", "rector"] },
  { key: "notas-acudientes", label: "Notas para acudientes", icon: Star, group: "Convivencia", roles: ["director_grupo", "acudiente"] },
  { key: "sms", label: "Comunicación SMS", icon: Smartphone, group: "Convivencia", roles: ["director_grupo", "coordinador", "rector", "administrativo"] },

  // Comunidad
  { key: "comunidad", label: "Comunidad (Feed)", icon: MessageSquare, group: "Comunidad" },
  { key: "mensajeria", label: "Mensajería directa", icon: MessageSquare, group: "Comunidad" },
  { key: "gobierno-escolar", label: "Gobierno escolar", icon: Vote, group: "Comunidad", roles: ["rector", "coordinador", "administrativo", "estudiante", "acudiente", "docente"] },
  { key: "inscripcion", label: "Inscripción en línea", icon: FileText, group: "Comunidad", roles: ["administrativo", "rector", "acudiente"] },
  { key: "pre-matricula", label: "Pre-Matrícula", icon: Users, group: "Comunidad", roles: ["administrativo", "rector", "acudiente"] },

  // Administración
  { key: "usuarios", label: "Usuarios", icon: UserCog, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "gestion-grupos", label: "Gestión de Grupos", icon: Users, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "gestion-estudiantes", label: "Gestión de Estudiantes", icon: GraduationCap, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "modelos-educativos", label: "Modelos educativos", icon: School, group: "Administración", roles: ["rector", "coordinador", "administrativo"] },
  { key: "conceptos-evaluativos", label: "Conceptos evaluativos", icon: ClipboardList, group: "Administración", roles: ["rector", "administrativo"], hidden: true },
  { key: "libros", label: "Libros reglamentarios", icon: BookOpen, group: "Administración", roles: ["rector", "administrativo", "coordinador"] },
  { key: "actas", label: "Actas institucionales", icon: FileText, group: "Administración", roles: ["rector", "coordinador", "administrativo"] },
  { key: "matricula", label: "Matrícula", icon: ClipboardCheck, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "asignacion", label: "Asignación académica", icon: Building2, group: "Administración", roles: ["rector", "coordinador", "administrativo"] },
  { key: "periodos", label: "Periodos académicos", icon: Calendar, group: "Administración", roles: ["rector", "coordinador", "administrativo"], hidden: true },
  { key: "talento-humano", label: "Talento Humano", icon: Users, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "auditoria", label: "Auditoría", icon: ScrollText, group: "Administración", roles: ["rector", "administrativo"] },
  { key: "configuracion", label: "Configuración", icon: Settings, group: "Administración", roles: ["rector", "administrativo"] },
  // [theme-options] Opciones de Tema — configuración global del sitio
  { key: "opciones-tema", label: "Opciones de tema", icon: Palette, group: "Administración", roles: ["rector", "administrativo"] },

  // Constructor de módulos — admin
  { key: "custom-module-builder", label: "Constructor de módulos", icon: Boxes, group: "Constructor", roles: ["administrativo"] },
  // Aprobación de módulos — rector
  { key: "module-approvals", label: "Aprobar módulos", icon: CheckCircle, group: "Constructor", roles: ["rector"] },

  // Parámetros del sistema (PDF) — rector y administrativo
  { key: "param-academic-years", label: "Años académicos", icon: Calendar, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-institution", label: "Institución", icon: Building2, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-subjects", label: "Asignaturas", icon: BookOpen, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-curriculum-plans", label: "Plan de estudios", icon: ListTree, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-evaluation-scales", label: "Escalas valorativas", icon: Scale, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-indicator-adjectives", label: "Adjetivos indicadores", icon: FileText, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-branches", label: "Sedes", icon: MapPin, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-journeys", label: "Jornadas", icon: Clock, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-report-templates", label: "Plantillas de reportes", icon: FileText, group: "Parámetros", roles: ["rector", "administrativo"] },
  { key: "param-report-variables", label: "Variables de reporte", icon: Variable, group: "Parámetros", roles: ["rector", "administrativo"] },
];

export function InstitutionalPanel() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { activeModule, setModule, sidebarOpen, setSidebar } = useUIStore();
  const [customModules, setCustomModules] = useState<any[]>([]);

  // Al cambiar de módulo, el contenido vuelve al top. El scroll vertical vive
  // en el documento (raíz min-h-screen), por lo que se usa window.scrollTo
  // solo en este efecto de navegación: no interfiere con los scrolls internos
  // de modales, dropdowns ni tablas con overflow propio.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeModule]);

  // Cargar módulos personalizados publicados
  useEffect(() => {
    if (!user) return;
    const myRoles = user.roles?.length ? user.roles : [user.role];
    fetch(`/api/custom-modules?institutionId=${user.institution.id}&status=published`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          // Filtrar por roles visibles para este usuario (cualquiera de sus roles)
          const visible = d.modules.filter((m: any) =>
            m.visibleRoles.some((r: string) => myRoles.includes(r))
          );
          setCustomModules(visible);
        }
      })
      .catch(() => {});
  }, [user]);

  // Filtrar navegación por rol (un ítem es visible si corresponde a cualquiera de los roles del usuario)
  const filteredNav = useMemo(() => {
    if (!user) return [];
    const myRoles = user.roles?.length ? user.roles : [user.role];
    return NAV.filter((n) => !n.hidden && (!n.roles || n.roles.some((r) => myRoles.includes(r))));
  }, [user]);

  // Agrupar
  const groups = useMemo(() => {
    const g: Record<string, NavItem[]> = {};
    filteredNav.forEach((n) => {
      if (!g[n.group]) g[n.group] = [];
      g[n.group].push(n);
    });
    // Añadir módulos personalizados a su área (o a "Personalizado" por defecto)
    customModules.forEach((m) => {
      const area = m.area || "Personalizado";
      if (!g[area]) g[area] = [];
      g[area].push({
        key: customModuleKey(m.id) as any,
        label: m.menuLabel || m.name,
        icon: Wand2,
        group: area,
      });
    });
    return g;
  }, [filteredNav, customModules]);

  if (!user) return null;

  function renderModule() {
    // Módulo personalizado en runtime
    if (isCustomModule(activeModule)) {
      const modId = getCustomModuleId(activeModule);
      if (modId) return <CustomModuleRuntimeView moduleId={modId} />;
    }
    switch (activeModule) {
      case "dashboard":
        return <DashboardView />;
      case "notas":
      case "indicadores":
        return <GradesView mode={activeModule === "indicadores" ? "indicadores" : "default"} />;
      // [F3] Gestión de Actividades
      case "gestion-actividades":
        return <ActivitiesManagementView />;
      case "asistencia":
        return <AttendanceView />;
      case "observador":
        return <ObserverView />;
      case "convivencia":
        return <CoexistenceView />;
      case "orientacion":
        return <OrientationsView />;
      case "comunidad":
        return <CommunityView />;
      case "mensajeria":
        return <MessagesView />;
      case "actas":
        return <MeetingsView />;
      case "libros":
      case "matricula":
      case "asignacion":
      case "periodos":
      case "configuracion":
      case "talento-humano":
        return <AcademicoView module={activeModule} />;
      case "auditoria":
        return <AuditView />;
      // [theme-options] Opciones de Tema
      case "opciones-tema":
        return <ThemeOptionsView />;
      case "usuarios":
        return <UsersView />;
      case "gestion-grupos":
        return <GroupsView />;
      case "gestion-estudiantes":
        return <StudentsListView />;
      case "modelos-educativos":
        return <ModelsListView />;
      case "conceptos-evaluativos":
        return <ConceptsListView />;
      case "talleres":
        return <WorkshopsView />;
      case "estudiantes":
        return <StudentsView />;
      case "pre-informe":
        return <PreInformeView />;
      case "planeador":
      case "e-learning":
      case "autoevaluacion":
      case "supervision":
        return <PlannerView module={activeModule} />;
      case "direccion-grupo":
      case "notas-acudientes":
      case "sms":
        return <GroupDirectionView module={activeModule} />;
      case "gobierno-escolar":
      case "inscripcion":
      case "pre-matricula":
        return <EnrollmentsView module={activeModule} />;
      case "custom-module-builder":
        return <CustomModuleBuilderView />;
      case "module-approvals":
        return <ModuleApprovalsView />;
      case "param-academic-years":
        return <ParamsView module="academic-years" />;
      case "param-subjects":
        return <ParamsView module="subjects" />;
      case "param-curriculum-plans":
        return <ParamsView module="curriculum-plans" />;
      case "param-evaluation-scales":
        return <ParamsView module="evaluation-scales" />;
      case "param-indicator-adjectives":
        return <ParamsView module="indicator-adjectives" />;
      case "param-institution":
        return <ParamsView module="institution" />;
      case "param-branches":
        return <ParamsView module="branches" />;
      case "param-journeys":
        return <ParamsView module="journeys" />;
      case "param-report-templates":
        return <ParamsView module="report-templates" />;
      case "param-report-variables":
        return <ParamsView module="report-variables" />;
      default:
        return <DashboardView />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--app-bg)]">
      {/* Topbar moderno con glassmorphism */}
      <header className="sticky top-0 z-30 glass-header">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setSidebar(true)}
              aria-label="Abrir menú"
            >
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="avatar-circle h-9 w-9 text-xs shadow-sm">
                Ap
              </div>
              <div className="hidden sm:block min-w-0">
                <div className="text-sm font-semibold truncate">{user.institution.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Año {user.institution.academicYear} · {roleLabel(user.role)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 rounded-lg" aria-label="Notificaciones">
              <Bell className="h-4 w-4" />
              <Badge variant="secondary" className="text-[10px] h-4 px-1">3</Badge>
            </Button>
            <ThemeSwitcher compact />
            <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 hairline-l">
              <div className="avatar-circle h-9 w-9 text-xs">
                {user.fullName.charAt(0)}
              </div>
              <div className="text-xs leading-tight hidden md:block">
                <div className="font-medium truncate max-w-[120px]">{user.fullName.split(" ").slice(0, 2).join(" ")}</div>
                <div className="text-muted-foreground">{user.jobTitle}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                logout();
                toast("Sesión cerrada");
              }}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 flex-shrink-0 hairline-r bg-[var(--app-sidebar)] overflow-y-auto">
          <SidebarContent
            groups={groups}
            active={activeModule}
            onNavigate={setModule}
          />
        </aside>

        {/* Sidebar móvil */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebar}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 hairline-b">
              <SheetTitle className="text-sm">Navegación</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-[calc(100%-3.5rem)]">
              <SidebarContent
                groups={groups}
                active={activeModule}
                onNavigate={(m) => {
                  setModule(m);
                  setSidebar(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  groups,
  active,
  onNavigate,
}: {
  groups: Record<string, NavItem[]>;
  active: ModuleKey;
  onNavigate: (m: ModuleKey) => void;
}) {
  return (
    <nav className="p-3 space-y-5">
      {Object.entries(groups).map(([group, items], groupIndex) => (
        <Collapsible key={group} defaultOpen={groupIndex > 0}>
          <CollapsibleTrigger className="group w-full flex items-center justify-between px-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {group}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );
}

function roleLabel(r: string) {
  const m: Record<string, string> = {
    rector: "Rectoría",
    coordinador: "Coordinación",
    director_grupo: "Dirección de Grupo",
    docente: "Docente",
    orientador: "Orientación",
    acudiente: "Acudiente",
    estudiante: "Estudiante",
    administrativo: "Administrativo",
  };
  return m[r] || r;
}

import { toast } from "sonner";
