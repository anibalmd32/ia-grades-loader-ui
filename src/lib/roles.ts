import {
  Bell,
  BookOpen,
  FileUp,
  GraduationCap,
  type LucideIcon,
  MessageCircle,
  NotebookPen,
  Send,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { AcademicSettings } from "@/api/queries/settings";
import type { Role, User } from "@/stores/session";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  coordinator: "Coordinador",
  teacher: "Profesor",
  student: "Estudiante",
};

/** Entrada del menú; la etiqueta puede depender de la configuración académica */
export type NavEntry = {
  to: string;
  label: string | ((settings: AcademicSettings) => string);
  icon: LucideIcon;
  /** false: solo en el menú lateral, no en la barra inferior del móvil (que tiene poco sitio) */
  dock?: boolean;
};
/** Entrada del menú lista para mostrar (con un contador, p. ej. avisos sin leer) */
export type NavItem = Omit<NavEntry, "label"> & { label: string; badge?: number };

const ADMIN_NAV: NavEntry[] = [
  { to: "/admin/teachers", label: "Profesores", icon: Users },
  { to: "/admin/students", label: "Estudiantes", icon: GraduationCap },
  {
    to: "/admin/academic",
    label: (settings) => `${settings.period_label_plural} y materias`,
    icon: BookOpen,
  },
];

export const NAV: Record<Role, NavEntry[]> = {
  super_admin: [
    { to: "/admin/coordinators", label: "Coordinadores", icon: ShieldCheck },
    ...ADMIN_NAV,
    // Solo el super admin: reglas académicas (periodos, lapsos y escala de notas)
    { to: "/admin/settings", label: "Configuración", icon: Settings, dock: false },
  ],
  coordinator: ADMIN_NAV,
  teacher: [
    { to: "/teacher/subjects", label: "Mis materias", icon: NotebookPen },
    { to: "/teacher/imports", label: "Importaciones", icon: FileUp },
  ],
  student: [
    { to: "/student/grades", label: "Mis notas", icon: GraduationCap },
    { to: "/student/assistant", label: "Asistente IA", icon: MessageCircle },
    { to: "/student/telegram", label: "Telegram", icon: Send },
    // En el móvil la campana está en la barra superior
    { to: "/student/notifications", label: "Avisos", icon: Bell, dock: false },
  ],
};

/** Resuelve la etiqueta de una entrada del menú con la configuración académica */
export function navItem(entry: NavEntry, settings: AcademicSettings): NavItem {
  return {
    ...entry,
    label: typeof entry.label === "function" ? entry.label(settings) : entry.label,
  };
}

/** Pantalla de inicio de cada rol (tras el login) */
export function homePath(role: Role): string {
  return (NAV[role][0] as NavEntry).to;
}

/**
 * Iniciales para el avatar: primera letra del nombre y del apellido si vienen por separado
 * ("Carmen" + "Rojas" → "CR"); si no, de las dos primeras palabras del nombre completo.
 */
export function initials(person: {
  full_name: string;
  first_name?: string;
  last_name?: string;
}): string {
  const first = person.first_name?.trim();
  const last = person.last_name?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return person.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Subtítulo bajo el nombre: "Estudiante · V-28456123" o el rol */
export function userSubtitle(user: User): string {
  const role = ROLE_LABEL[user.role];
  return user.cedula_display ? `${role} · ${user.cedula_display}` : role;
}
