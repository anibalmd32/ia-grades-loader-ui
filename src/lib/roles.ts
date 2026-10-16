import {
  BookOpen,
  FileUp,
  GraduationCap,
  type LucideIcon,
  MessageCircle,
  NotebookPen,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Role, User } from "@/stores/session";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  coordinator: "Coordinador",
  teacher: "Profesor",
  student: "Estudiante",
};

export type NavItem = { to: string; label: string; icon: LucideIcon };

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/teachers", label: "Profesores", icon: Users },
  { to: "/admin/students", label: "Estudiantes", icon: GraduationCap },
  { to: "/admin/academic", label: "Semestres y materias", icon: BookOpen },
];

export const NAV: Record<Role, NavItem[]> = {
  super_admin: [
    { to: "/admin/coordinators", label: "Coordinadores", icon: ShieldCheck },
    ...ADMIN_NAV,
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
  ],
};

/** Pantalla de inicio de cada rol (tras el login) */
export function homePath(role: Role): string {
  return NAV[role][0].to;
}

/** "Carmen Rojas" → "CR" */
export function initials(name: string): string {
  return name
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
