import { useEffect } from "react";
import type { Conjunto } from "@/lib/api";
import { PiezasLook } from "@/components/PiezasLook";
import { Boton, ETIQUETA, VIDRIO } from "@/components/espejoUi";

const VUELTA_AUTOMATICA_MS = 20000;

// Confirmación al estilo del espejo: panel lateral de vidrio y centro libre. Vuelve sola al inicio.
export function PanelConfirmado({
  conjunto,
  onCerrar,
}: {
  conjunto: Conjunto;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onCerrar, VUELTA_AUTOMATICA_MS);
    return () => clearTimeout(t);
  }, [onCerrar]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-3">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m7.5 12.5 3 3 6-7" />
        </svg>
        <div>
          <p className={ETIQUETA}>Look confirmado</p>
          <p className="text-sm font-light text-white/90">Que lo disfrutes.</p>
        </div>
      </div>

      <div className={`${VIDRIO} p-3`}>
        <PiezasLook piezas={conjunto.piezas} />
      </div>

      <div>
        <Boton onClick={onCerrar}>Volver</Boton>
      </div>
    </div>
  );
}
