import { initials } from "@/lib/roles";

const SIZES = { sm: "w-9 text-xs", lg: "w-16 text-xl" };

/** Persona con nombre y apellido por separado (UserRead, StudentSummary) */
export type AvatarPerson = { full_name: string; first_name?: string; last_name?: string };

export function Avatar({
  person,
  size = "sm",
}: {
  person: AvatarPerson;
  size?: keyof typeof SIZES;
}) {
  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div className={`rounded-full bg-primary text-primary-content ${SIZES[size]}`}>
        <span className="font-bold">{initials(person)}</span>
      </div>
    </div>
  );
}
