import type { ReactNode } from "react";

/** Pantallas de acceso (instalación, login, cambio de contraseña): panel de marca + tarjeta */
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
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-neutral px-6 py-8 text-neutral-content lg:flex lg:w-[43%] lg:flex-col lg:justify-center lg:px-16">
        <p className="font-bold text-primary text-sm lg:text-base">IA Grades Loader</p>
        <h2 className="mt-2 max-w-md font-bold text-2xl leading-tight lg:mt-4 lg:text-5xl">
          Las notas de tu universidad, en un solo lugar.
        </h2>
        <p className="mt-6 hidden max-w-md text-neutral-content/80 lg:block">
          Profesores cargan notas a mano o desde Excel con ayuda de IA. Estudiantes consultan sus
          notas por lapso, le preguntan al asistente o lo hacen por Telegram.
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center bg-base-100 lg:items-center lg:bg-base-200 lg:p-8">
        <div className="w-full max-w-md p-6 lg:rounded-box lg:border lg:border-base-300 lg:bg-base-100 lg:p-10 lg:shadow-sm">
          <h1 className="font-bold text-2xl lg:text-3xl">{title}</h1>
          <p className="mt-1 text-base-content/70 text-sm">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
