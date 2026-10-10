import { useEffect } from "react";
import type { Conjunto } from "@/lib/api";
import { Boton, ETIQUETA, VIDRIO } from "@/components/espejoUi";

const VUELTA_AUTOMATICA_MS = 20000;

// Confirmación al estilo del espejo: panel lateral de vidrio y centro libre. Vuelve sola al inicio.
export function PanelConfirmado({ conjunto, onCerrar }: { conjunto: Conjunto; onCerrar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, VUELTA_AUTOMATICA_MS);
    return () => clearTimeout(t);
  }, [onCerrar]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-3">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="10" />
          <path d="m7.5 12.5 3 3 6-7" />
        </svg>
        <div>
          <p className={ETIQUETA}>Look confirmado</p>
          <p className="text-sm font-light text-white/90">Que lo disfrutes.</p>
        </div>
      </div>

      <div className={`${VIDRIO} p-3 flex gap-3`}>
        {conjunto.piezas.map((p) => (
          <figure key={p.id} className="flex-1 min-w-0 flex flex-col gap-1.5">
            <img src={p.foto_path} alt={p.tipo} className="w-full h-52 object-cover" />
            <figcaption className="text-[10px] uppercase tracking-[0.18em] text-white/80 truncate">
              {p.tipo} · {p.color}
            </figcaption>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 truncate">
              {p.formalidad} · {p.abrigo}
            </p>
          </figure>
        ))}
      </div>

      <div>
        <Boton onClick={onCerrar}>Volver</Boton>
      </div>
    </div>
  );
}
