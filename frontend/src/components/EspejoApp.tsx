import { useEffect, useState, type ReactNode } from "react";
import { FondoEspejo } from "@/components/FondoEspejo";
import { PantallaExito } from "@/components/PantallaExito";
import { useAsistenteVoz } from "@/hooks/useAsistenteVoz";
import { useCombinaciones } from "@/hooks/useCombinaciones";
import { useGestos, type Gesto } from "@/hooks/useGestos";

const CARD_PX = 460;
const GAP_PX = 40;

// Lenguaje visual del espejo: vidrio translúcido, líneas finas y tipografía mínima en mayúsculas.
const VIDRIO = "bg-black/35 backdrop-blur-md border border-white/25";
const ETIQUETA = "text-[11px] uppercase tracking-[0.22em] text-white/70";

function Boton({
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

function Flecha({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "izq" ? "Anterior" : "Siguiente"}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white transition-colors"
      style={lado === "izq" ? { left: 0 } : { right: 0 }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d={lado === "izq" ? "M15 4 7 12l8 8" : "m9 4 8 8-8 8"} />
      </svg>
    </button>
  );
}

export function EspejoApp() {
  const [modoEspejo, setModoEspejo] = useState(false);
  const [gestosActivos, setGestosActivos] = useState(false);
  const [seleccion, setSeleccion] = useState(0);

  const {
    sesionId,
    conjuntos,
    clima,
    buscando,
    aviso,
    confirmado,
    verCombinaciones,
    aceptar,
    cambiarPrenda,
    otrasOpciones,
    cerrarConfirmacion,
  } = useCombinaciones();

  function etapaActual(): string {
    return conjuntos.length > 0 ? "mostrando_combinaciones" : "inicio";
  }

  const { escuchando, transcripcion, respuestaAsistente, alMicrofono, reiniciarHistorial, vozDisponible } = useAsistenteVoz({
    etapaActual,
    contextoExtra: () => ({ piezas_conjunto: conjuntos[0]?.piezas.map((p) => p.tipo) ?? [] }),
    onAccion: (resp, texto) => {
      switch (resp.accion) {
        case "ver_combinaciones":
          verCombinaciones("preciso", resp.ocasion ?? null, texto);
          break;
        case "confirmar_conjunto":
          aceptar(0);
          reiniciarHistorial();
          break;
        case "cambiar_prenda": {
          const tipoBuscado = (resp.parametro || "").toLowerCase();
          const pieza = conjuntos[0]?.piezas.find((p) => p.tipo.toLowerCase().includes(tipoBuscado));
          if (pieza) cambiarPrenda(0, pieza.id);
          break;
        }
        case "otras_opciones":
          otrasOpciones();
          break;
      }
    },
  });

  useEffect(() => {
    setSeleccion(0);
  }, [conjuntos]);

  function alGesto(g: Gesto) {
    if (confirmado || buscando) return;
    switch (g) {
      case "confirmar":
        if (conjuntos.length > 0) aceptar(Math.min(seleccion, conjuntos.length - 1));
        break;
      case "rechazar":
        if (conjuntos.length > 0) otrasOpciones();
        break;
      case "siguiente":
        if (conjuntos.length > 1) setSeleccion((i) => (i + 1) % conjuntos.length);
        break;
      case "anterior":
        if (conjuntos.length > 1) setSeleccion((i) => (i - 1 + conjuntos.length) % conjuntos.length);
        break;
      case "voz":
        if (vozDisponible && !escuchando) alMicrofono();
        break;
    }
  }

  const { videoRef, estado: estadoGestos, error: errorGestos, detectado, progreso, ultimo } = useGestos({
    activo: gestosActivos,
    onGesto: alGesto,
  });

  const hayConjuntos = conjuntos.length > 0;
  const actual = hayConjuntos ? conjuntos[Math.min(seleccion, conjuntos.length - 1)] : null;

  return (
    <div className="relative h-screen overflow-hidden text-white flex flex-col">
      {modoEspejo ? (
        <FondoEspejo />
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-neutral-900 to-neutral-800" />
      )}

      {/* ---------- Barra superior ---------- */}
      <header className="flex items-center justify-between px-10 pt-7">
        <div>
          <h1 className="text-sm uppercase tracking-[0.35em] font-medium">Armario Inteligente</h1>
          {clima && (
            <p className={`${ETIQUETA} mt-1`}>
              Santiago · {clima.temperatura_c}°C · {clima.categoria}
              {clima.precipitacion_mm > 0 ? " · lluvia" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Boton pequeno onClick={() => setGestosActivos((v) => !v)}>
            {gestosActivos ? "Gestos · on" : "Gestos · off"}
          </Boton>
          <Boton pequeno onClick={() => setModoEspejo((v) => !v)}>
            {modoEspejo ? "Modo espejo" : "Modo UI"}
          </Boton>
        </div>
      </header>

      {confirmado ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <PantallaExito conjunto={confirmado} onCerrar={cerrarConfirmacion} oscuro />
        </div>
      ) : (
        <main className="flex-1 grid grid-cols-[260px_1fr_260px] gap-6 px-10 py-6 min-h-0">
          {/* ---------- Izquierda: voz ---------- */}
          <aside className="flex flex-col gap-4 min-h-0">
            <p className={ETIQUETA}>Asistente</p>
            <button
              type="button"
              onClick={alMicrofono}
              disabled={!vozDisponible || escuchando}
              aria-label="Hablar con el asistente"
              className={`w-16 h-16 rounded-full border flex items-center justify-center text-2xl transition-colors ${
                escuchando ? "bg-red-500/80 border-red-300 animate-pulse" : `${VIDRIO} hover:bg-white/20`
              } disabled:opacity-60`}
            >
              🎙️
            </button>
            <p className="text-xs text-white/70">
              {!vozDisponible ? "Tu navegador no soporta voz" : escuchando ? "Escuchando…" : "Toca y habla"}
            </p>
            {transcripcion && <p className="text-sm text-white/90">“{transcripcion}”</p>}
            {respuestaAsistente && <p className={`${VIDRIO} text-sm italic p-3 text-white/90`}>{respuestaAsistente}</p>}
            {aviso && <p className="text-sm text-amber-200">{aviso}</p>}
          </aside>

          {/* ---------- Centro: opciones ---------- */}
          <section className="flex flex-col items-center justify-center min-h-0 gap-6">
            {buscando && !hayConjuntos && <p className={ETIQUETA}>Armando tu look…</p>}

            {!hayConjuntos && !buscando && !sesionId && (
              <div className="flex flex-col items-center gap-5 text-center">
                <p className="text-3xl font-light tracking-wide max-w-md">¿Qué te pones hoy?</p>
                <p className="text-sm text-white/70 max-w-sm">
                  Pídelo con la voz, con un gesto ✊, o toca el botón.
                </p>
                <Boton primario onClick={() => verCombinaciones("exploratorio")}>
                  Ver combinaciones
                </Boton>
              </div>
            )}

            {hayConjuntos && (
              <>
                <p className={ETIQUETA}>
                  Opción {Math.min(seleccion, conjuntos.length - 1) + 1} de {conjuntos.length}
                </p>

                <div className="relative w-full overflow-hidden" style={{ height: 470 }}>
                  {conjuntos.length > 1 && <Flecha lado="izq" onClick={() => alGesto("anterior")} />}
                  {conjuntos.length > 1 && <Flecha lado="der" onClick={() => alGesto("siguiente")} />}
                  <div
                    className="flex items-stretch h-full transition-transform duration-500 ease-out"
                    style={{
                      gap: `${GAP_PX}px`,
                      width: `${conjuntos.length * CARD_PX + (conjuntos.length - 1) * GAP_PX}px`,
                      marginLeft: "50%",
                      transform: `translateX(${-(seleccion * (CARD_PX + GAP_PX) + CARD_PX / 2)}px)`,
                    }}
                  >
                    {conjuntos.map((c, idx) => (
                      <article
                        key={idx}
                        onClick={() => setSeleccion(idx)}
                        style={{ width: `${CARD_PX}px` }}
                        className={`shrink-0 flex flex-col p-4 gap-3 cursor-pointer transition-all duration-500 ${VIDRIO} ${
                          idx === seleccion ? "border-white/80 opacity-100" : "opacity-40 scale-95"
                        }`}
                      >
                        <div className="flex gap-3 flex-1 min-h-0">
                          {c.piezas.map((p) => (
                            <figure key={p.id} className="flex-1 min-w-0 flex flex-col gap-1.5">
                              <img src={p.foto_path} alt={p.tipo} className="w-full flex-1 min-h-0 object-cover" />
                              <figcaption className="text-[10px] uppercase tracking-[0.18em] text-white/80 truncate">
                                {p.tipo} · {p.color}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                        <p className="text-sm font-light italic text-white/85 leading-snug line-clamp-3">{c.razon}</p>
                      </article>
                    ))}
                  </div>
                </div>

                {conjuntos.length > 1 && (
                  <div className="flex gap-2">
                    {conjuntos.map((_, idx) => (
                      <span
                        key={idx}
                        className={`h-px transition-all ${idx === seleccion ? "w-10 bg-white" : "w-5 bg-white/40"}`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <Boton primario onClick={() => aceptar(seleccion)} disabled={buscando}>
                    Confirmar
                  </Boton>
                  <Boton onClick={otrasOpciones} disabled={buscando}>
                    Otras opciones
                  </Boton>
                </div>
              </>
            )}
          </section>

          {/* ---------- Derecha: prendas de la opción + gestos ---------- */}
          <aside className="flex flex-col gap-4 min-h-0 text-right">
            {actual && (
              <>
                <p className={ETIQUETA}>En esta opción</p>
                <ul className="flex flex-col gap-3">
                  {actual.piezas.map((p) => (
                    <li key={p.id} className={`${VIDRIO} p-2 flex items-center gap-3 text-left`}>
                      <img src={p.foto_path} alt={p.tipo} className="w-14 h-16 object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-[0.15em] truncate">{p.tipo}</p>
                        <p className="text-[11px] text-white/60 truncate">
                          {p.color} · {p.formalidad}
                        </p>
                        <button
                          type="button"
                          onClick={() => cambiarPrenda(Math.min(seleccion, conjuntos.length - 1), p.id)}
                          disabled={buscando}
                          className="mt-1 text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/80 hover:text-white disabled:opacity-40"
                        >
                          Cambiar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-auto flex flex-col items-end gap-2">
              {gestosActivos ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="w-44 border border-white/30"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <p className="text-[11px] text-white/80">
                    {estadoGestos === "cargando" && "Cargando gestos…"}
                    {estadoGestos === "error" && errorGestos}
                    {estadoGestos === "listo" &&
                      (ultimo ? `✔ ${ultimo}` : detectado ? `Veo: ${detectado}` : "Muestra tu mano a la cámara")}
                  </p>
                  {progreso > 0 && (
                    <div className="w-44 h-px bg-white/25">
                      <div className="h-px bg-white" style={{ width: `${progreso * 100}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Activa “Gestos” para controlarlo con la mano.
                </p>
              )}
              <p className={`${ETIQUETA} mt-1`}>Gestos</p>
              <ul className="text-[11px] text-white/60 leading-relaxed">
                <li>👍 sostener · confirmar</li>
                <li>👎 sostener · otras opciones</li>
                <li>👋 mover a los lados · pasar</li>
                <li>✊ sostener · hablar</li>
              </ul>
              {modoEspejo && (
                <p className="text-[10px] text-white/50 max-w-48 leading-tight">
                  Cámara solo como fondo visual. No se graba ni se envía a ningún servidor.
                </p>
              )}
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
