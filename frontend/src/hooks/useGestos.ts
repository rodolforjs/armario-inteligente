import { useEffect, useRef, useState } from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";

export type Gesto = "confirmar" | "rechazar" | "siguiente" | "anterior" | "voz" | "silencio";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODELO_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const MANTENER_MS = 700; // un gesto estático debe sostenerse para dispararse (evita falsos positivos)
const ENFRIAMIENTO_MS = 1500; // tras un gesto estático (confirmar/rechazar/voz)
const ENFRIAMIENTO_SWIPE_MS = 600; // deslizar debe poder repetirse rápido, como pasar fotos
const VENTANA_SWIPE_MS = 400;
const DESPLAZAMIENTO_SWIPE = 0.18; // fracción del ancho de la imagen
const CONFIANZA_MIN = 0.6;
const INTERVALO_MS = 66; // ~15 fps, de sobra para gestos y liviano para el equipo

// Categorías de MediaPipe -> acción. Palma abierta no dispara nada por sí sola: solo sirve para deslizar.
const ESTATICOS: Record<string, Gesto> = {
  Thumb_Up: "confirmar",
  Thumb_Down: "rechazar",
  Closed_Fist: "voz",
  Pointing_Up: "silencio", // dedo en alto: "shh", corta al asistente
};

export function useGestos({ activo, onGesto }: { activo: boolean; onGesto: (g: Gesto) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onGestoRef = useRef(onGesto);
  onGestoRef.current = onGesto;

  const [estado, setEstado] = useState<"apagado" | "cargando" | "listo" | "error">("apagado");
  const [error, setError] = useState("");
  const [detectado, setDetectado] = useState<string>("");
  const [progreso, setProgreso] = useState(0);
  const [ultimo, setUltimo] = useState<Gesto | null>(null);

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
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no da acceso a la cámara (¿HTTPS?).");
        const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
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
      let trayectoria: { t: number; x: number }[] = [];

      function disparar(g: Gesto, ahora: number) {
        bloqueadoHasta = ahora + (g === "siguiente" || g === "anterior" ? ENFRIAMIENTO_SWIPE_MS : ENFRIAMIENTO_MS);
        trayectoria = [];
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
        if (ahora - ultimaLectura < INTERVALO_MS || video.currentTime === ultimoFrame) return;
        ultimaLectura = ahora;
        ultimoFrame = video.currentTime;

        const res = reconocedor.recognizeForVideo(video, ahora);
        const cat = res.gestures[0]?.[0];
        const nombre = cat && cat.score >= CONFIANZA_MIN ? cat.categoryName : "";
        setDetectado(nombre === "None" ? "" : nombre);

        if (ahora < bloqueadoHasta) return;

        // --- Deslizar en el aire: cualquier mano que se mueve en horizontal (en coordenadas espejo, como se ve
        // en pantalla). Una mano en movimiento rara vez clasifica como "palma abierta", así que no lo exigimos;
        // solo excluimos los gestos estáticos (pulgar, puño) para no confundirlos.
        const mano = res.landmarks[0];
        if (mano && !ESTATICOS[nombre]) {
          const centro = (mano[0].x + mano[9].x) / 2; // muñeca + base del dedo medio: estable al mover la mano
          trayectoria.push({ t: ahora, x: 1 - centro });
          trayectoria = trayectoria.filter((p) => ahora - p.t <= VENTANA_SWIPE_MS);
          const dx = trayectoria[trayectoria.length - 1].x - trayectoria[0].x;
          if (Math.abs(dx) >= DESPLAZAMIENTO_SWIPE) {
            disparar(dx > 0 ? "siguiente" : "anterior", ahora);
            return;
          }
        } else {
          trayectoria = [];
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
      setDetectado("");
      setProgreso(0);
    };
  }, [activo]);

  return { videoRef, estado, error, detectado, progreso, ultimo };
}
