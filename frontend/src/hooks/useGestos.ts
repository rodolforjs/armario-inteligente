import { useEffect, useRef, useState } from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";

export type Gesto =
  "confirmar" | "rechazar" | "siguiente" | "anterior" | "voz" | "silencio";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODELO_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const MANTENER_MS = 700; // un gesto estático debe sostenerse para dispararse (evita falsos positivos)
const ENFRIAMIENTO_MS = 1500; // tras un gesto estático (confirmar/rechazar/voz)
// Desplazar entre opciones: se "agarra" con la palma abierta y la mano arrastra la selección (como un scroll).
const ARMAR_MS = 350; // palma abierta sostenida para empezar a desplazar
const PASO_NAV = 0.14; // cuánto hay que mover la mano (fracción del ancho) para pasar a la opción siguiente
const HISTERESIS_NAV = 0.65; // evita que la selección parpadee al estar entre dos opciones
const PERDIDA_NAV_MS = 600; // sin mano este tiempo, se suelta
const CONFIANZA_MIN = 0.6;
const INTERVALO_MS = 66; // ~15 fps, de sobra para gestos y liviano para el equipo

// Categorías de MediaPipe -> acción. La palma abierta no dispara nada por sí sola: sirve para desplazar.
const ESTATICOS: Record<string, Gesto> = {
  Thumb_Up: "confirmar",
  Thumb_Down: "rechazar",
  Closed_Fist: "voz",
  Pointing_Up: "silencio", // dedo en alto: "shh", corta al asistente
};

export type Navegacion = { total: number; actual: number };

export function useGestos({
  activo,
  onGesto,
  navegacion,
  onNavegar,
}: {
  activo: boolean;
  onGesto: (g: Gesto) => void;
  navegacion: () => Navegacion;
  onNavegar: (indice: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onGestoRef = useRef(onGesto);
  onGestoRef.current = onGesto;
  const navegacionRef = useRef(navegacion);
  navegacionRef.current = navegacion;
  const onNavegarRef = useRef(onNavegar);
  onNavegarRef.current = onNavegar;

  const [estado, setEstado] = useState<
    "apagado" | "cargando" | "listo" | "error"
  >("apagado");
  const [error, setError] = useState("");
  const [detectado, setDetectado] = useState<string>("");
  const [progreso, setProgreso] = useState(0);
  const [ultimo, setUltimo] = useState<Gesto | null>(null);
  const [navegando, setNavegando] = useState(false);
  const [posicion, setPosicion] = useState(0.5);

  useEffect(() => {
    if (!activo) {
      setEstado("apagado");
      return;
    }

    let cancelado = false;
    let stream: MediaStream | null = null;
    let reconocedor: GestureRecognizer | null = null;
    let raf = 0;

    async function iniciar() {
      setEstado("cargando");
      setError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Este navegador no da acceso a la cámara (¿HTTPS?).");
        const { FilesetResolver, GestureRecognizer } =
          await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        reconocedor = await GestureRecognizer.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELO_URL },
          runningMode: "VIDEO",
          numHands: 1,
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelado) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setEstado("listo");
        bucle(video);
      } catch (err) {
        if (cancelado) return;
        setEstado("error");
        setError((err as Error).message || "No se pudo iniciar los gestos.");
      }
    }

    function bucle(video: HTMLVideoElement) {
      let ultimaLectura = 0;
      let ultimoFrame = -1;
      let gestoActual = "";
      let desde = 0;
      let bloqueadoHasta = 0;
      let armadoDesde = 0;
      let navActiva = false;
      let ancla = 0;
      let base = 0;
      let offset = 0;
      let xSuave: number | null = null;
      let ultimaMano = 0;

      function soltar() {
        navActiva = false;
        armadoDesde = 0;
        setNavegando(false);
      }

      function disparar(g: Gesto, ahora: number) {
        bloqueadoHasta = ahora + ENFRIAMIENTO_MS;
        gestoActual = "";
        setProgreso(0);
        setUltimo(g);
        onGestoRef.current(g);
        setTimeout(() => setUltimo((u) => (u === g ? null : u)), 1200);
      }

      function paso() {
        if (cancelado || !reconocedor) return;
        raf = requestAnimationFrame(paso);
        const ahora = performance.now();
        if (
          ahora - ultimaLectura < INTERVALO_MS ||
          video.currentTime === ultimoFrame
        )
          return;
        ultimaLectura = ahora;
        ultimoFrame = video.currentTime;

        const res = reconocedor.recognizeForVideo(video, ahora);
        const cat = res.gestures[0]?.[0];
        const nombre =
          cat && cat.score >= CONFIANZA_MIN ? cat.categoryName : "";
        setDetectado(nombre === "None" ? "" : nombre);

        const mano = res.landmarks[0];
        if (mano) ultimaMano = ahora;
        else if (navActiva && ahora - ultimaMano > PERDIDA_NAV_MS) soltar();

        if (ahora < bloqueadoHasta) return;

        // --- Desplazar: palma abierta sostenida = "agarrar"; mover la mano a los lados arrastra la selección.
        // Es por posición (no por velocidad): ir y volver es natural y no dispara el movimiento contrario.
        if (mano) {
          const x = 1 - (mano[0].x + mano[9].x) / 2; // espejo, como se ve en pantalla
          xSuave = xSuave === null ? x : xSuave + 0.5 * (x - xSuave);
          const nav = navegacionRef.current();
          if (nav.total < 2) {
            if (navActiva) soltar();
          } else if (!navActiva) {
            if (nombre === "Open_Palm") {
              if (!armadoDesde) armadoDesde = ahora;
              const avance = Math.min(1, (ahora - armadoDesde) / ARMAR_MS);
              setProgreso(avance);
              if (avance >= 1) {
                navActiva = true;
                ancla = xSuave;
                base = nav.actual;
                offset = 0;
                setProgreso(0);
                setNavegando(true);
              }
              return;
            }
            armadoDesde = 0;
          } else if (!ESTATICOS[nombre]) {
            const minOffset = -base;
            const maxOffset = nav.total - 1 - base;
            let crudo = (xSuave - ancla) / PASO_NAV;
            // en los extremos el ancla se corre, para no tener que deshacer lo que sobró
            if (crudo > maxOffset + 0.5) {
              ancla = xSuave - (maxOffset + 0.5) * PASO_NAV;
              crudo = maxOffset + 0.5;
            } else if (crudo < minOffset - 0.5) {
              ancla = xSuave - (minOffset - 0.5) * PASO_NAV;
              crudo = minOffset - 0.5;
            }
            if (Math.abs(crudo - offset) > HISTERESIS_NAV) {
              offset = Math.max(
                minOffset,
                Math.min(maxOffset, Math.round(crudo)),
              );
              onNavegarRef.current(base + offset);
            }
            setPosicion(xSuave);
          }
        } else {
          xSuave = null;
          armadoDesde = 0;
        }

        // --- Gestos estáticos: sostener ---
        const accion = ESTATICOS[nombre];
        if (!accion) {
          gestoActual = "";
          setProgreso(0);
          return;
        }
        if (nombre !== gestoActual) {
          gestoActual = nombre;
          desde = ahora;
        }
        const avance = Math.min(1, (ahora - desde) / MANTENER_MS);
        setProgreso(avance);
        if (avance >= 1) disparar(accion, ahora);
      }

      raf = requestAnimationFrame(paso);
    }

    iniciar();

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      reconocedor?.close();
      setNavegando(false);
      setDetectado("");
      setProgreso(0);
    };
  }, [activo]);

  return {
    videoRef,
    estado,
    error,
    detectado,
    progreso,
    ultimo,
    navegando,
    posicion,
  };
}
