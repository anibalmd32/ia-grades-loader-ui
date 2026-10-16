import { initials } from "@/lib/roles";

const SIZES = { sm: "w-9 text-xs", lg: "w-16 text-xl" };

export function Avatar({ name, size = "sm" }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div className={`rounded-full bg-primary text-primary-content ${SIZES[size]}`}>
        <span className="font-bold">{initials(name)}</span>
      </div>
    </div>
  );
}
