import { useRef } from "react";
import type { Conjunto } from "@/lib/api";
import { Boton, Chevron, ETIQUETA, VIDRIO } from "@/components/espejoUi";

// Vista final: la opción se muestra en un panel lateral compacto y el centro del espejo queda libre.
export function PanelOpcion({
  conjuntos,
  seleccion,
  buscando,
  yaPidio,
  pista,
  onMover,
  onConfirmar,
  onOtras,
  onCambiar,
  onVer,
}: {
  conjuntos: Conjunto[];
  seleccion: number;
  buscando: boolean;
  yaPidio: boolean;
  pista: string;
  onMover: (delta: 1 | -1) => void;
  onConfirmar: () => void;
  onOtras: () => void;
  onCambiar: (piezaId: number) => void;
  onVer: () => void;
}) {
  const actual =
    conjuntos.length > 0
      ? conjuntos[Math.min(seleccion, conjuntos.length - 1)]
      : null;
  const previa = useRef(seleccion);
  const direccion = seleccion >= previa.current ? 1 : -1;
  previa.current = seleccion;

  if (!actual) {
    return (
      <div className="flex flex-col items-end gap-4 text-right">
        {buscando ? (
          <p className={ETIQUETA}>Armando tu look…</p>
        ) : (
          !yaPidio && (
            <>
              <p className="text-2xl font-light tracking-wide">
                ¿Qué te pones hoy?
              </p>
              <p className="text-xs text-white/70 max-w-64">{pista}</p>
              <Boton primario onClick={onVer}>
                Ver combinaciones
              </Boton>
            </>
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between">
        <p className={ETIQUETA}>
          Opción {Math.min(seleccion, conjuntos.length - 1) + 1} de{" "}
          {conjuntos.length}
        </p>
        {conjuntos.length > 1 && (
          <div className="flex">
            <Chevron lado="izq" onClick={() => onMover(-1)} />
            <Chevron lado="der" onClick={() => onMover(1)} />
          </div>
        )}
      </div>

      <div
        key={seleccion}
        className={`${VIDRIO} p-3 flex flex-col gap-3 animate-[opcion-entra_300ms_ease-out]`}
        style={{ "--desde": `${direccion * 40}px` } as React.CSSProperties}
      >
        <div className="flex gap-3">
          {actual.piezas.map((p) => (
            <figure key={p.id} className="flex-1 min-w-0 flex flex-col gap-1.5">
              <img
                src={p.foto_path}
                alt={p.tipo}
                className="w-full h-52 object-cover"
              />
              <figcaption className="text-[10px] uppercase tracking-[0.18em] text-white/80 truncate">
                {p.tipo} · {p.color}
              </figcaption>
              <button
                type="button"
                onClick={() => onCambiar(p.id)}
                disabled={buscando}
                className="self-start text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/70 hover:text-white disabled:opacity-40"
              >
                Cambiar
              </button>
            </figure>
          ))}
        </div>
        <p className="text-sm font-light italic text-white/85 leading-snug">
          {actual.razon}
        </p>
      </div>

      <div className="flex gap-3">
        <Boton primario onClick={onConfirmar} disabled={buscando}>
          Confirmar
        </Boton>
        <Boton onClick={onOtras} disabled={buscando}>
          Otras opciones
        </Boton>
      </div>
    </div>
  );
}
