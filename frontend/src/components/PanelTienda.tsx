import { useEffect, useState } from "react";
import { api, type ProductoMercado } from "@/lib/api";
import { COLORES } from "@/components/PanelInsights";
import { ETIQUETA, VIDRIO } from "@/components/espejoUi";

// Ideas de ropa nueva según lo que falta en tu closet. Catálogo curado de ejemplo de H&M y Zara (simulación).
export function PanelTienda({ onCerrar }: { onCerrar: () => void }) {
  const [productos, setProductos] = useState<ProductoMercado[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .sugerenciasMercado()
      .then((r) => setProductos(r.sugerencias))
      .catch(() => setError(true));
  }, []);

  return (
    <aside
      className={`${VIDRIO} fixed top-20 left-10 bottom-6 w-[340px] z-30 p-5 overflow-y-auto flex flex-col gap-4`}
    >
      <div className="flex items-center justify-between">
        <p className={ETIQUETA}>Para ti · tienda</p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="text-white/70 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
      <p className="text-[11px] text-white/50 leading-snug">
        Simulación: catálogo de ejemplo de H&M y Zara elegido según lo que te
        falta. Las imágenes son ilustrativas (generadas con IA) y los enlaces abren la búsqueda en la tienda.
      </p>

      {!productos && !error && (
        <p className={ETIQUETA}>Buscando ideas para ti…</p>
      )}
      {error && (
        <p className="text-sm text-amber-200">
          No pude cargar las sugerencias ahora.
        </p>
      )}
      {productos?.length === 0 && (
        <p className="text-sm text-white/70">
          Ya tienes de todo lo que tengo para sugerirte.
        </p>
      )}

      {productos?.map((p) => (
        <article
          key={p.id}
          className="border border-white/20 p-3 flex flex-col gap-2"
        >
          <img
            src={p.imagen}
            alt={p.nombre}
            loading="lazy"
            className="w-full h-44 object-cover"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
              {p.marca}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/70">
              <span
                className="w-3 h-3 rounded-full border border-white/40"
                style={{ background: COLORES[p.color] ?? "#888" }}
              />
              {p.color}
            </span>
          </div>
          <p className="text-sm tracking-wide">{p.nombre}</p>
          <p className="text-[12px] italic font-light text-white/80 leading-snug">
            {p.motivo}
          </p>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/80 hover:text-white"
          >
            Ver en {p.marca} ↗
          </a>
        </article>
      ))}
    </aside>
  );
}
