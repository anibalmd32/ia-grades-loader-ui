import { Search } from "lucide-react";
import { useEffect, useState } from "react";

/** Búsqueda que espera 300 ms tras dejar de escribir antes de avisar del cambio */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <label className="input w-full sm:max-w-sm">
      <Search className="size-4 opacity-60" />
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  );
}
