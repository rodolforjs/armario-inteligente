import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FondoEspejo } from "@/components/FondoEspejo";
import { PantallaExito } from "@/components/PantallaExito";
import { useAsistenteVoz } from "@/hooks/useAsistenteVoz";
import { useCombinaciones } from "@/hooks/useCombinaciones";
import { useGestos, type Gesto } from "@/hooks/useGestos";

const CARD_PX = 288;
const GAP_PX = 24;

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

  return (
    <div className="relative min-h-screen text-white flex flex-col items-center justify-center p-8 gap-6">
      {modoEspejo ? (
        <FondoEspejo />
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-neutral-900 to-neutral-800" />
      )}

      <div className="fixed top-4 right-4 flex flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setModoEspejo((v) => !v)}
          className="bg-white/10 backdrop-blur"
        >
          {modoEspejo ? "🪞 Modo espejo" : "🖥️ Modo UI"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setGestosActivos((v) => !v)}
          className="bg-white/10 backdrop-blur"
        >
          {gestosActivos ? "🖐️ Gestos: activados" : "🖐️ Activar gestos"}
        </Button>
        {gestosActivos && (
          <div className="flex flex-col items-end gap-1">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-40 rounded-lg border border-white/30"
              style={{ transform: "scaleX(-1)" }}
            />
            <p className="text-[11px] text-white/80 drop-shadow text-right max-w-48">
              {estadoGestos === "cargando" && "Cargando gestos..."}
              {estadoGestos === "error" && errorGestos}
              {estadoGestos === "listo" &&
                (ultimo ? `✔ ${ultimo}` : detectado ? `Veo: ${detectado}` : "Muestra tu mano a la cámara")}
            </p>
            {progreso > 0 && (
              <div className="w-40 h-1.5 rounded bg-white/20 overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${progreso * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-white/60 text-right max-w-48 leading-tight">
              👍 confirmar · 👎 otras opciones · 👋 mueve la mano a los lados para pasar opciones · ✊ hablar
            </p>
          </div>
        )}
        {modoEspejo && (
          <p className="text-[11px] text-white/70 drop-shadow max-w-48 text-right">
            Cámara encendida solo como fondo visual. No se graba ni se envía a ningún servidor.
          </p>
        )}
      </div>

      <h1 className="text-3xl font-semibold drop-shadow-lg">Armario Inteligente</h1>

      {confirmado ? (
        <PantallaExito conjunto={confirmado} onCerrar={cerrarConfirmacion} oscuro />
      ) : (
        <>
          <Button
            type="button"
            size="lg"
            onClick={alMicrofono}
            disabled={!vozDisponible || escuchando}
            variant={escuchando ? "danger" : "default"}
            className="rounded-full w-24 h-24 text-4xl shadow-xl"
          >
            🎙️
          </Button>
          <p className="text-sm text-white/80 drop-shadow">
            {!vozDisponible ? "Tu navegador no soporta voz" : escuchando ? "Escuchando..." : "Toca y habla"}
          </p>
          {transcripcion && <p className="text-sm drop-shadow">Tú: "{transcripcion}"</p>}
          {respuestaAsistente && (
            <p className="text-sm italic text-white/90 drop-shadow max-w-md text-center">{respuestaAsistente}</p>
          )}

          {!sesionId && !buscando && conjuntos.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => verCombinaciones("exploratorio")}
              className="bg-white/10 backdrop-blur"
            >
              ✨ Ver combinaciones
            </Button>
          )}

          {aviso && <p className="text-sm text-white/90 drop-shadow">{aviso}</p>}
          {clima && conjuntos.length > 0 && (
            <p className="text-xs text-white/70 drop-shadow">
              Santiago ahora: {clima.temperatura_c}°C, {clima.categoria}
              {clima.precipitacion_mm > 0 ? " (con lluvia)" : ""}
            </p>
          )}

          {conjuntos.length > 0 && (
            <div className="flex flex-col items-center gap-3 w-full">
              {/* Carrusel: la tarjeta seleccionada va al centro y el resto se desliza a los lados */}
              <div className="relative w-full max-w-3xl overflow-hidden py-4">
                <div
                  className="flex items-stretch transition-transform duration-500 ease-out"
                  style={{
                    gap: `${GAP_PX}px`,
                    width: `${conjuntos.length * CARD_PX + (conjuntos.length - 1) * GAP_PX}px`,
                    marginLeft: "50%",
                    transform: `translateX(${-(seleccion * (CARD_PX + GAP_PX) + CARD_PX / 2)}px)`,
                  }}
                >
                  {conjuntos.map((c, idx) => (
                    <Card
                      key={idx}
                      onClick={() => setSeleccion(idx)}
                      style={{ width: `${CARD_PX}px` }}
                      className={`shrink-0 bg-white/90 backdrop-blur transition-all duration-500 ${
                        idx === seleccion ? "scale-100 opacity-100" : "scale-90 opacity-50"
                      }`}
                    >
                      <CardContent className="flex flex-col gap-3 pt-4">
                        <div className="flex gap-2 overflow-x-auto">
                          {c.piezas.map((p) => (
                            <img key={p.id} src={p.foto_path} alt={p.tipo} className="w-20 h-20 object-cover rounded-lg" />
                          ))}
                        </div>
                        <p className="italic text-sm text-muted-foreground">{c.razon}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => aceptar(idx)} disabled={buscando}>
                            Confirmar
                          </Button>
                          {c.piezas.map((p) => (
                            <Button
                              key={p.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => cambiarPrenda(idx, p.id)}
                              disabled={buscando}
                            >
                              Cambiar {p.tipo}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              {conjuntos.length > 1 && (
                <div className="flex items-center gap-3 text-white/80 drop-shadow">
                  <button type="button" onClick={() => alGesto("anterior")} className="text-xl px-2" aria-label="Anterior">
                    ◀
                  </button>
                  <div className="flex gap-1.5">
                    {conjuntos.map((_, idx) => (
                      <span
                        key={idx}
                        className={`h-2 rounded-full transition-all ${idx === seleccion ? "w-6 bg-white" : "w-2 bg-white/40"}`}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => alGesto("siguiente")} className="text-xl px-2" aria-label="Siguiente">
                    ▶
                  </button>
                </div>
              )}
            </div>
          )}

          {conjuntos.length > 0 && (
            <Button type="button" variant="secondary" onClick={otrasOpciones} disabled={buscando} className="bg-white/10 backdrop-blur">
              Pedir otras opciones
            </Button>
          )}
        </>
      )}
    </div>
  );
}
