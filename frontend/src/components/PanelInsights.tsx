import { useEffect, useState } from "react";
import { api, type Clima, type EventoLog, type Prenda } from "@/lib/api";
import { ETIQUETA, VIDRIO } from "@/components/espejoUi";

const COLORES: Record<string, string> = {
  blanco: "#f5f5f5", negro: "#111", gris: "#888", azul: "#2f5fb3", "azul oscuro": "#1c2b4d", celeste: "#8fc3ea",
  rojo: "#c0392b", verde: "#3d8b5a", amarillo: "#e8c53a", naranjo: "#e67e22", rosado: "#e8a0bf", morado: "#7d4fa3",
  café: "#6b4a2f", beige: "#d8c7a8", crema: "#efe4cc", burdeo: "#6d1f2e",
};

function contar<T>(items: T[], clave0: (t: T) => string) {
  const m = new Map<string, number>();
  const clave = (t: T) => clave0(t).trim().toLowerCase();
  for (const i of items) m.set(clave(i), (m.get(clave(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function hace(iso: string | undefined) {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

function Barras({ datos, total }: { datos: [string, number][]; total: number }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {datos.map(([k, n]) => (
        <li key={k} className="flex items-center gap-2 text-[11px]">
          <span className="w-20 truncate text-white/80">{k}</span>
          <span className="flex-1 h-px bg-white/20 relative">
            <span className="absolute left-0 -top-px h-[3px] bg-white" style={{ width: `${(n / total) * 100}%` }} />
          </span>
          <span className="w-5 text-right text-white/70">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function Dato({ valor, texto }: { valor: string | number; texto: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-light">{valor}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-white/60">{texto}</span>
    </div>
  );
}

export function PanelInsights({ clima, onCerrar }: { clima: Clima | null; onCerrar: () => void }) {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [eventos, setEventos] = useState<EventoLog[]>([]);

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      try {
        const [p, e] = await Promise.all([api.listarPrendas(), api.listarEventos()]);
        if (vivo) {
          setPrendas(p);
          setEventos(e);
        }
      } catch {
        // se mantiene lo último cargado
      }
    }
    cargar();
    const t = setInterval(cargar, 10000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const disponibles = prendas.filter((p) => p.estado === "disponible");
  const fuera = prendas.filter((p) => p.estado === "fuera");
  const usadas = [...prendas].filter((p) => p.veces_usada > 0).sort((a, b) => b.veces_usada - a.veces_usada);
  const nunca = prendas.filter((p) => p.veces_usada === 0);
  const ultimoEscaneo = eventos.find((e) => e.tipo === "closet_escaneado");
  const conteo = (t: string) => eventos.filter((e) => e.tipo === t).length;
  const pedidas = conteo("recomendacion_solicitada");
  const aceptadas = conteo("prenda_aceptada");
  const colores = contar(prendas, (p) => p.color);

  return (
    <aside className={`${VIDRIO} fixed top-20 left-10 bottom-6 w-[320px] z-30 p-5 overflow-y-auto flex flex-col gap-6`}>
      <div className="flex items-center justify-between">
        <p className={ETIQUETA}>Tu closet · insights</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-white/70 hover:text-white text-lg leading-none">
          ×
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Dato valor={disponibles.length} texto="en el closet" />
        <Dato valor={fuera.length} texto="fuera" />
        <Dato valor={prendas.length} texto="total" />
      </div>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Último escaneo</p>
        <p className="text-sm text-white/90">
          {hace(ultimoEscaneo?.timestamp)} · {conteo("closet_escaneado")} escaneos
        </p>
        {fuera.length > 0 && (
          <p className="text-[11px] text-white/60">Fuera: {fuera.map((p) => `${p.tipo} ${p.color}`).join(", ")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Por tipo</p>
        <Barras datos={contar(prendas, (p) => p.tipo).slice(0, 6)} total={Math.max(1, prendas.length)} />
      </section>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Paleta</p>
        <div className="flex flex-wrap gap-2">
          {colores.map(([c, n]) => (
            <span key={c} className="flex items-center gap-1.5 text-[11px] text-white/80">
              <span className="w-3 h-3 rounded-full border border-white/40" style={{ background: COLORES[c] ?? "#666" }} />
              {c} {n}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Formalidad</p>
        <Barras datos={contar(prendas, (p) => p.formalidad)} total={Math.max(1, prendas.length)} />
      </section>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Uso</p>
        {usadas.length > 0 ? (
          <p className="text-sm text-white/90">
            Más usada: {usadas[0].tipo} {usadas[0].color} ({usadas[0].veces_usada}×)
          </p>
        ) : (
          <p className="text-sm text-white/70">Aún no confirmas ningún look.</p>
        )}
        <p className="text-[11px] text-white/60">{nunca.length} prendas sin estrenar en el sistema</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className={ETIQUETA}>Asistente</p>
        <div className="grid grid-cols-3 gap-3">
          <Dato valor={pedidas} texto="looks pedidos" />
          <Dato valor={aceptadas} texto="aceptados" />
          <Dato valor={conteo("conjunto_rechazado")} texto="rechazados" />
        </div>
      </section>

      {clima && (
        <section className="flex flex-col gap-1">
          <p className={ETIQUETA}>Hoy</p>
          <p className="text-sm text-white/90">
            {clima.temperatura_c}°C · {clima.categoria} · viento {clima.viento_kmh} km/h
            {clima.precipitacion_mm > 0 ? ` · lluvia ${clima.precipitacion_mm} mm` : ""}
          </p>
        </section>
      )}
    </aside>
  );
}
