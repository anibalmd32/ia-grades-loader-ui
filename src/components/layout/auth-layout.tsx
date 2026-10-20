import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Pantallas de acceso (instalación, login, cambio de contraseña): solo la tarjeta del
 * formulario, centrada. El panel de marca del diseño v1 se quitó a propósito.
 */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-start justify-center bg-base-100 pt-[env(safe-area-inset-top)] sm:items-center sm:bg-base-200 sm:p-8">
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md p-6 sm:rounded-box sm:border sm:border-base-300 sm:bg-base-100 sm:p-10 sm:shadow-sm">
        <img src="/favicon.svg" alt="Notas" className="mb-5 size-12 rounded-xl" />
        <h1 className="font-bold text-2xl sm:text-3xl">{title}</h1>
        <p className="mt-1 text-base-content/70 text-sm">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
