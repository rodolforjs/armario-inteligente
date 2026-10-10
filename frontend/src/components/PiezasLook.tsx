import type { PiezaConjunto } from "@/lib/api";

const CAMBIAR =
  "self-start text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/70 hover:text-white disabled:opacity-40";

// Prendas base (arriba/abajo) grandes; calzado y accesorios como fila de miniaturas debajo.
export function PiezasLook({
  piezas,
  llenar = false,
  onCambiar,
  deshabilitado,
}: {
  piezas: PiezaConjunto[];
  llenar?: boolean;
  onCambiar?: (piezaId: number) => void;
  deshabilitado?: boolean;
}) {
  const base = piezas.filter((p) => p.rol !== "extra");
  const extras = piezas.filter((p) => p.rol === "extra");

  return (
    <div className={`flex flex-col gap-3 ${llenar ? "flex-1 min-h-0" : ""}`}>
      <div className={`flex gap-3 ${llenar ? "flex-1 min-h-0" : ""}`}>
        {base.map((p) => (
          <figure key={p.id} className="flex-1 min-w-0 flex flex-col gap-1.5">
            <img
              src={p.foto_path}
              alt={p.tipo}
              className={`w-full object-cover ${llenar ? "flex-1 min-h-0" : "h-52"}`}
            />
            <figcaption className="text-[10px] uppercase tracking-[0.18em] text-white/80 truncate">
              {p.tipo} · {p.color}
            </figcaption>
            {onCambiar && (
              <button
                type="button"
                onClick={() => onCambiar(p.id)}
                disabled={deshabilitado}
                className={CAMBIAR}
              >
                Cambiar
              </button>
            )}
          </figure>
        ))}
      </div>

      {extras.length > 0 && (
        <div className="flex gap-3 border-t border-white/15 pt-3">
          {extras.map((p) => (
            <figure
              key={p.id}
              className="flex-1 min-w-0 flex items-center gap-2"
            >
              <img
                src={p.foto_path}
                alt={p.tipo}
                className="w-12 h-12 object-cover shrink-0"
              />
              <figcaption className="min-w-0 flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/80 truncate">
                  {p.tipo}
                </span>
                <span className="text-[10px] text-white/50 truncate">
                  {p.color}
                </span>
                {onCambiar && (
                  <button
                    type="button"
                    onClick={() => onCambiar(p.id)}
                    disabled={deshabilitado}
                    className={CAMBIAR}
                  >
                    Cambiar
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
