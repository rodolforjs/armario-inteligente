import type { ReactNode } from "react";

// Lenguaje visual del espejo: vidrio translúcido, líneas finas y tipografía mínima en mayúsculas.
export const VIDRIO = "bg-black/35 backdrop-blur-md border border-white/25";
export const ETIQUETA = "text-[11px] uppercase tracking-[0.22em] text-white/70";

export function Boton({
  children,
  onClick,
  disabled,
  primario,
  pequeno,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primario?: boolean;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`uppercase tracking-[0.18em] border transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        pequeno ? "text-[10px] px-3 py-1.5" : "text-xs px-6 py-3"
      } ${
        primario
          ? "bg-white text-black border-white hover:bg-white/85"
          : "border-white/50 text-white hover:bg-white hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

export function Chevron({
  lado,
  onClick,
}: {
  lado: "izq" | "der";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "izq" ? "Anterior" : "Siguiente"}
      className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white transition-colors"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d={lado === "izq" ? "M15 4 7 12l8 8" : "m9 4 8 8-8 8"} />
      </svg>
    </button>
  );
}

export function Flecha({
  lado,
  onClick,
}: {
  lado: "izq" | "der";
  onClick: () => void;
}) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 z-10"
      style={lado === "izq" ? { left: 0 } : { right: 0 }}
    >
      <Chevron lado={lado} onClick={onClick} />
    </div>
  );
}
