import { useEffect, useRef, useState } from "react";
import { FondoEspejo } from "@/components/FondoEspejo";
import { PiezasLook } from "@/components/PiezasLook";
import { GuiaVestir } from "@/components/GuiaVestir";
import { PanelTienda } from "@/components/PanelTienda";
import { ordenarParaVestir } from "@/lib/vestir";
import { useAsistenteVoz } from "@/hooks/useAsistenteVoz";
import { useCombinaciones } from "@/hooks/useCombinaciones";
import { useGestos, type Gesto } from "@/hooks/useGestos";
import { useNombreAsistente } from "@/hooks/useNombreAsistente";
import { usePersistido } from "@/hooks/usePersistido";
import { AjustesAsistente } from "@/components/AjustesAsistente";
import { AJUSTES_VOZ_BASE, type AjustesVoz } from "@/lib/voz";
import type { RespuestaVoz } from "@/lib/api";
import { PanelInsights } from "@/components/PanelInsights";
import { PanelOpcion } from "@/components/PanelOpcion";
import { Boton, ETIQUETA, Flecha, VIDRIO } from "@/components/espejoUi";

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const CARD_PX = 460;
const GAP_PX = 40;

export function EspejoApp() {
  const [vista, setVista] = usePersistido<"final" | "pruebas">(
    "espejo.vista",
    "pruebas",
  );
  const [modoEspejo, setModoEspejo] = usePersistido("espejo.camara", false);
  const [gestosActivos, setGestosActivos] = usePersistido(
    "espejo.gestos",
    false,
  );
  const [nombreActivo, setNombreActivo] = usePersistido(
    "espejo.llamarPorNombre",
    false,
  );
  const [nombre, setNombre] = usePersistido("espejo.nombre", "Alba");
  const [tono, setTono] = usePersistido("espejo.tono", "cercano");
  const [ajustesVoz, setAjustesVoz] = usePersistido<AjustesVoz>(
    "espejo.vozAjustes",
    AJUSTES_VOZ_BASE,
  );
  const despuesDeHablar = useRef<(resp: RespuestaVoz) => void>(() => {});
  const final = vista === "final";
  const [panel, setPanel] = useState<null | "insights" | "tienda">(null);
  const [paso, setPaso] = useState(0);
  const [seleccion, setSeleccion] = useState(0);

  const {
    sesionId,
    pedidoActual,
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
    if (confirmado) return "vistiendose";
    return conjuntos.length > 0 ? "mostrando_combinaciones" : "inicio";
  }

  // "Otras opciones" rechaza solo la que se está mostrando; las demás se quedan.
  function rechazarVisible() {
    if (conjuntos.length > 0) otrasOpciones(Math.min(seleccion, conjuntos.length - 1));
  }

  function avanzarPaso() {
    if (!confirmado) return;
    setPaso((p) => Math.min(p + 1, confirmado.piezas.length));
  }

  const {
    escuchando,
    transcripcion,
    respuestaAsistente,
    alMicrofono,
    procesarTexto,
    silenciar,
    reiniciarHistorial,
    vozDisponible,
  } = useAsistenteVoz({
    etapaActual,
    persona: () => ({ nombre, tono }),
    alTerminarDeHablar: (resp) => despuesDeHablar.current(resp),
    contextoExtra: () => {
      const visto = conjuntos[Math.min(seleccion, conjuntos.length - 1)];
      return {
        piezas_conjunto: visto?.piezas.map((p) => `${p.tipo} ${p.color}`) ?? [],
        razon_conjunto: visto?.razon ?? null,
        ocasion_actual: pedidoActual.current.ocasion,
        preferencias_actuales: pedidoActual.current.preferencias,
        paso_actual: confirmado
          ? (() => {
              const pieza = ordenarParaVestir(confirmado.piezas)[paso];
              return pieza
                ? `${pieza.tipo} ${pieza.color}`
                : "ya terminó de vestirse";
            })()
          : null,
      };
    },
    onAccion: (resp, texto) => {
      const idx = Math.min(seleccion, conjuntos.length - 1);
      switch (resp.accion) {
        case "ver_combinaciones":
          verCombinaciones(
            "exploratorio",
            resp.ocasion ?? pedidoActual.current.ocasion,
            texto,
            resp.preferencias ?? null,
          );
          break;
        case "confirmar_conjunto":
          aceptar(idx);
          reiniciarHistorial();
          break;
        case "cambiar_prenda": {
          const buscado = normalizar(resp.parametro || "");
          const pieza = conjuntos[idx]?.piezas.find((p) => {
            const tipo = normalizar(p.tipo);
            return (
              buscado !== "" &&
              (buscado.includes(tipo) || tipo.includes(buscado))
            );
          });
          if (pieza) cambiarPrenda(idx, pieza.id);
          break;
        }
        case "otras_opciones":
          rechazarVisible();
          break;
        case "ver_tienda":
          setPanel("tienda");
          break;
        case "siguiente_paso":
          avanzarPaso();
          break;
      }
    },
  });

  // Al quitar o cambiar una opción se conserva la posición (acotada); un lote nuevo vuelve a la primera.
  useEffect(() => {
    setSeleccion((i) => Math.min(i, Math.max(0, conjuntos.length - 1)));
  }, [conjuntos]);

  useEffect(() => {
    setSeleccion(0);
  }, [sesionId]);

  useEffect(() => {
    setPaso(0);
  }, [confirmado]);

  function alGesto(g: Gesto) {
    if (g === "silencio") {
      silenciar();
      return;
    }
    if (confirmado) {
      // Guía para vestirse: el pulgar arriba avanza al siguiente paso.
      if (g === "confirmar") avanzarPaso();
      else if (g === "voz" && vozDisponible && !escuchando) alMicrofono();
      return;
    }
    if (buscando) return;
    switch (g) {
      case "confirmar":
        if (conjuntos.length > 0)
          aceptar(Math.min(seleccion, conjuntos.length - 1));
        break;
      case "rechazar":
        rechazarVisible();
        break;
      case "siguiente":
        if (conjuntos.length > 1)
          setSeleccion((i) => (i + 1) % conjuntos.length);
        break;
      case "anterior":
        if (conjuntos.length > 1)
          setSeleccion((i) => (i - 1 + conjuntos.length) % conjuntos.length);
        break;
      case "voz":
        if (vozDisponible && !escuchando) alMicrofono();
        break;
    }
  }

  const {
    videoRef,
    estado: estadoGestos,
    error: errorGestos,
    detectado,
    progreso,
    ultimo,
    navegando,
    posicion,
  } = useGestos({
    activo: gestosActivos,
    onGesto: alGesto,
    navegacion: () => ({
      total: conjuntos.length,
      actual: Math.min(seleccion, conjuntos.length - 1),
    }),
    onNavegar: setSeleccion,
  });

  const {
    estado: estadoNombre,
    oido,
    disponible: nombreDisponible,
    mantenerAtento,
  } = useNombreAsistente({
    activo: nombreActivo && !escuchando,
    nombre,
    onComando: procesarTexto,
  });
  // Conversación continua: tras hablar, deja abierta la escucha (por nombre) o reabre el micrófono si hizo una pregunta.
  despuesDeHablar.current = (resp) => {
    if (nombreActivo) mantenerAtento();
    else if (resp.seguir_escuchando) alMicrofono();
  };
  const atento = estadoNombre === "atento" || escuchando;

  const hayConjuntos = conjuntos.length > 0;
  const actual = hayConjuntos
    ? conjuntos[Math.min(seleccion, conjuntos.length - 1)]
    : null;

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
          <h1 className="text-sm uppercase tracking-[0.35em] font-medium">
            Armario Inteligente
          </h1>
          {clima && clima.temperatura_c != null && (
            <p className={`${ETIQUETA} mt-1`}>
              Santiago · {clima.temperatura_c}°C · {clima.categoria}
              {clima.precipitacion_mm > 0 ? " · lluvia" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!final && (
            <>
              <Boton pequeno onClick={() => setNombreActivo((v) => !v)}>
                {nombreActivo
                  ? `Llamar “${nombre}” · on`
                  : `Llamar “${nombre}” · off`}
              </Boton>
              <Boton pequeno onClick={() => setGestosActivos((v) => !v)}>
                {gestosActivos ? "Gestos · on" : "Gestos · off"}
              </Boton>
              <Boton pequeno onClick={() => setModoEspejo((v) => !v)}>
                {modoEspejo ? "Modo espejo" : "Modo UI"}
              </Boton>
            </>
          )}
          <button
            type="button"
            onClick={() => setPanel((v) => (v === "tienda" ? null : "tienda"))}
            aria-label="Ideas de tienda"
            title="Ideas de tienda"
            className={`w-8 h-8 flex items-center justify-center border transition-colors ${
              panel === "tienda"
                ? "bg-white text-black border-white"
                : "border-white/50 text-white hover:bg-white hover:text-black"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M5 8h14l-1 12H6L5 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() =>
              setPanel((v) => (v === "insights" ? null : "insights"))
            }
            aria-label="Insights del closet"
            title="Insights del closet"
            className={`w-8 h-8 flex items-center justify-center border transition-colors ${
              panel === "insights"
                ? "bg-white text-black border-white"
                : "border-white/50 text-white hover:bg-white hover:text-black"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </button>
          <Boton pequeno onClick={() => setVista(final ? "pruebas" : "final")}>
            {final ? "Ir a vista pruebas" : "Ir a vista final"}
          </Boton>
        </div>
      </header>

      <main
        className={`flex-1 grid gap-6 px-10 py-6 min-h-0 ${
          final || confirmado
            ? "grid-cols-[320px_minmax(0,1fr)_380px]"
            : "grid-cols-[260px_minmax(0,1fr)_260px]"
        }`}
      >
        {/* ---------- Izquierda: asistente ---------- */}
        <aside className="flex flex-col gap-4 min-h-0">
          <p className={ETIQUETA}>{nombreActivo ? nombre : "Asistente"}</p>
          <button
            type="button"
            onClick={alMicrofono}
            disabled={!vozDisponible || escuchando}
            aria-label="Hablar con el asistente"
            className={`w-16 h-16 rounded-full border flex items-center justify-center text-2xl transition-all ${
              atento
                ? "bg-white/25 border-white shadow-[0_0_30px_rgba(255,255,255,0.5)] animate-pulse"
                : `${VIDRIO} hover:bg-white/20`
            } disabled:opacity-60`}
          >
            🎙️
          </button>
          <p className="text-xs text-white/70">
            {!vozDisponible
              ? "Tu navegador no soporta voz"
              : escuchando
                ? "Escuchando…"
                : estadoNombre === "atento"
                  ? "Te escucho…"
                  : estadoNombre === "esperando"
                    ? `Di “${nombre}” para llamarme`
                    : estadoNombre === "error"
                      ? "Sin permiso de micrófono"
                      : "Toca y habla"}
          </p>
          {transcripcion && (
            <p className="text-sm text-white/90">“{transcripcion}”</p>
          )}
          {respuestaAsistente && (
            <p className={`${VIDRIO} text-sm italic p-3 text-white/90`}>
              {respuestaAsistente}
            </p>
          )}
          {aviso && <p className="text-sm text-amber-200">{aviso}</p>}

          {!final && (
            <AjustesAsistente
              nombre={nombre}
              onNombre={setNombre}
              tono={tono}
              onTono={setTono}
              voz={ajustesVoz}
              onVoz={setAjustesVoz}
              oido={oido}
              escuchaDisponible={nombreDisponible}
            />
          )}
        </aside>

        {/* ---------- Centro ---------- */}
        {final || confirmado ? (
          <section aria-hidden="true" />
        ) : (
          <section className="flex flex-col items-center justify-center min-h-0 min-w-0 gap-6">
            {buscando && !hayConjuntos && (
              <p className={ETIQUETA}>Armando tu look…</p>
            )}

            {!hayConjuntos && !buscando && !sesionId && (
              <div className="flex flex-col items-center gap-5 text-center">
                <p className="text-3xl font-light tracking-wide max-w-md">
                  ¿Qué te pones hoy?
                </p>
                <p className="text-sm text-white/70 max-w-sm">
                  Pídelo con la voz, con un gesto ✊, o toca el botón.
                </p>
                <Boton
                  primario
                  onClick={() => verCombinaciones("exploratorio")}
                >
                  Ver combinaciones
                </Boton>
              </div>
            )}

            {hayConjuntos && (
              <>
                <p className={ETIQUETA}>
                  Opción {Math.min(seleccion, conjuntos.length - 1) + 1} de{" "}
                  {conjuntos.length}
                </p>

                <div
                  className="relative w-full overflow-hidden"
                  style={{ height: 470 }}
                >
                  {conjuntos.length > 1 && (
                    <Flecha lado="izq" onClick={() => alGesto("anterior")} />
                  )}
                  {conjuntos.length > 1 && (
                    <Flecha lado="der" onClick={() => alGesto("siguiente")} />
                  )}
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
                          idx === seleccion
                            ? "border-white/80 opacity-100"
                            : "opacity-40 scale-95"
                        }`}
                      >
                        <PiezasLook piezas={c.piezas} llenar />
                        <p className="text-sm font-light italic text-white/85 leading-snug line-clamp-3">
                          {c.razon}
                        </p>
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
                  <Boton
                    primario
                    onClick={() => aceptar(seleccion)}
                    disabled={buscando}
                  >
                    Confirmar
                  </Boton>
                  <Boton onClick={rechazarVisible} disabled={buscando}>
                    Otras opciones
                  </Boton>
                </div>
              </>
            )}
          </section>
        )}

        {/* ---------- Derecha ---------- */}
        {confirmado ? (
          <aside className="flex flex-col justify-center min-h-0">
            <GuiaVestir
              conjunto={confirmado}
              paso={paso}
              onPaso={setPaso}
              onCerrar={cerrarConfirmacion}
              tono={tono}
              nombre={nombre}
            />
          </aside>
        ) : final ? (
          <aside className="flex flex-col justify-center min-h-0">
            <PanelOpcion
              conjuntos={conjuntos}
              seleccion={seleccion}
              buscando={buscando}
              yaPidio={Boolean(sesionId)}
              pista={
                nombreActivo
                  ? `Di “${nombre}, ¿qué me pongo?”, haz un gesto o toca el botón.`
                  : "Toca el botón o usa un gesto."
              }
              onMover={(d) => alGesto(d === 1 ? "siguiente" : "anterior")}
              onConfirmar={() =>
                aceptar(Math.min(seleccion, conjuntos.length - 1))
              }
              onOtras={rechazarVisible}
              onCambiar={(id) =>
                cambiarPrenda(Math.min(seleccion, conjuntos.length - 1), id)
              }
              onVer={() => verCombinaciones("exploratorio")}
            />
          </aside>
        ) : (
          <aside className="flex flex-col gap-4 min-h-0 text-right">
            {actual && (
              <>
                <p className={ETIQUETA}>En esta opción</p>
                <ul className="flex flex-col gap-3">
                  {actual.piezas.map((p) => (
                    <li
                      key={p.id}
                      className={`${VIDRIO} p-2 flex items-center gap-3 text-left`}
                    >
                      <img
                        src={p.foto_path}
                        alt={p.tipo}
                        className="w-14 h-16 object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-[0.15em] truncate">
                          {p.tipo}
                        </p>
                        <p className="text-[11px] text-white/60 truncate">
                          {p.color} · {p.formalidad}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            cambiarPrenda(
                              Math.min(seleccion, conjuntos.length - 1),
                              p.id,
                            )
                          }
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

            <div
              className={`mt-auto flex flex-col items-end gap-2 ${gestosActivos ? "pb-52" : ""}`}
            >
              {!gestosActivos && (
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Activa “Gestos” para controlarlo con la mano.
                </p>
              )}
              <p className={`${ETIQUETA} mt-1`}>Gestos</p>
              <ul className="text-[11px] text-white/60 leading-relaxed">
                <li>👍 sostener · confirmar</li>
                <li>👎 sostener · otras opciones</li>
                <li>🖐️ palma abierta + mover · desplazar</li>
                <li>✊ sostener · hablar</li>
                <li>☝️ sostener · silencio</li>
              </ul>
              {modoEspejo && (
                <p className="text-[10px] text-white/50 max-w-48 leading-tight">
                  Cámara solo como fondo visual. No se graba ni se envía a
                  ningún servidor.
                </p>
              )}
            </div>
          </aside>
        )}
      </main>

      {panel === "insights" && (
        <PanelInsights clima={clima} onCerrar={() => setPanel(null)} />
      )}
      {panel === "tienda" && <PanelTienda onCerrar={() => setPanel(null)} />}

      {/* ---------- Vista previa de gestos (un solo <video>, fijo en la esquina) ---------- */}
      {gestosActivos && (
        <div
          className={`fixed bottom-6 flex flex-col gap-1.5 ${final ? "left-10 items-start" : "right-10 items-end"}`}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className={`border ${navegando ? "border-white" : "border-white/30"} w-48 ${final ? "opacity-80" : ""}`}
            style={{ transform: "scaleX(-1)" }}
          />
          <p className="text-[11px] text-white/80">
            {estadoGestos === "cargando" && "Cargando gestos…"}
            {estadoGestos === "error" && errorGestos}
            {estadoGestos === "listo" &&
              (navegando
                ? "Desplazando · mueve la mano a los lados"
                : progreso > 0
                  ? "Palma abierta… mantén"
                  : ultimo
                    ? `✔ ${ultimo}`
                    : detectado
                      ? `Veo: ${detectado}`
                      : final
                        ? ""
                        : "Muestra tu mano a la cámara")}
          </p>
          {navegando && conjuntos.length > 1 && (
            <div className="relative w-48 h-4">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
              {conjuntos.map((_, i) => (
                <span
                  key={i}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-white ${
                    i === Math.min(seleccion, conjuntos.length - 1)
                      ? "bg-white"
                      : "bg-transparent"
                  }`}
                  style={{ left: `${(i / (conjuntos.length - 1)) * 100}%` }}
                />
              ))}
              <span
                className="absolute top-0 w-px h-4 bg-white/70"
                style={{
                  left: `${Math.max(0, Math.min(1, (posicion - 0.2) / 0.6)) * 100}%`,
                }}
              />
            </div>
          )}
          {progreso > 0 && (
            <div className="w-48 h-px bg-white/25">
              <div
                className="h-px bg-white"
                style={{ width: `${progreso * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
