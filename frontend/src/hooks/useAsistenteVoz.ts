import { useRef, useState } from "react";
import { api, type RespuestaVoz } from "@/lib/api";
import { mensajeAmigable } from "@/lib/errores";
import { escuchar, hablar, vozDisponible } from "@/lib/voz";

type TurnoHistorial = { rol: "usuario" | "asistente"; texto: string };

const MAX_TURNOS = 10;

export function useAsistenteVoz({
  etapaActual,
  contextoExtra,
  onAccion,
}: {
  etapaActual: () => string;
  contextoExtra: () => Record<string, unknown>;
  onAccion: (resp: RespuestaVoz, texto: string) => void;
}) {
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState("");
  const [respuestaAsistente, setRespuestaAsistente] = useState("");
  const historialRef = useRef<TurnoHistorial[]>([]);

  async function manejarComandoVoz(texto: string) {
    setTranscripcion(texto);
    historialRef.current.push({ rol: "usuario", texto });
    try {
      const resp = await api.comandoVoz(texto, {
        etapa: etapaActual(),
        historial: historialRef.current.slice(-MAX_TURNOS),
        ...contextoExtra(),
      });
      setRespuestaAsistente(resp.respuesta_hablada);
      historialRef.current.push({ rol: "asistente", texto: resp.respuesta_hablada });
      hablar(resp.respuesta_hablada);
      if (resp.accion !== "preguntar") {
        onAccion(resp, texto);
      }
    } catch (err) {
      setRespuestaAsistente(mensajeAmigable((err as Error).message));
    }
  }

  function alMicrofono() {
    if (escuchando) return;
    setEscuchando(true);
    setTranscripcion("");
    escuchar(
      (texto) => manejarComandoVoz(texto),
      () => setEscuchando(false),
    );
  }

  function reiniciarHistorial() {
    historialRef.current = [];
  }

  return {
    escuchando,
    transcripcion,
    respuestaAsistente,
    alMicrofono,
    procesarTexto: manejarComandoVoz,
    reiniciarHistorial,
    vozDisponible,
  };
}
