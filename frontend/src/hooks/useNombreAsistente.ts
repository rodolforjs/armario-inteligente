import { useEffect, useRef, useState } from "react";

// Escucha continua tipo Alexa: no hace nada hasta oír el nombre del asistente.
// "Alba, ¿qué me pongo?" → ejecuta la frase; "Alba" a secas → queda atento unos segundos.
// Todo el reconocimiento ocurre en el navegador (Web Speech API).

const Ctor: typeof window.SpeechRecognition | undefined =
  window.SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

const VENTANA_ATENTO_MS = 8000;
const SILENCIO_TRAS_HABLAR_MS = 900;

export type EstadoNombre = "apagado" | "esperando" | "atento" | "error";

// Quita tildes sin cambiar el largo del texto, para poder cortar el original con los mismos índices.
function plegar(t: string) {
  return t
    .toLowerCase()
    .split("")
    .map((c) => c.normalize("NFD")[0])
    .join("");
}

function pitido() {
  try {
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.12);
    setTimeout(() => ac.close(), 300);
  } catch {
    // sin audio: queda solo el aviso visual
  }
}

export function useNombreAsistente({
  activo,
  nombre,
  onComando,
}: {
  activo: boolean;
  nombre: string;
  onComando: (texto: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoNombre>("apagado");
  const [oido, setOido] = useState("");
  const onComandoRef = useRef(onComando);
  onComandoRef.current = onComando;

  useEffect(() => {
    const limpio = plegar(nombre).replace(/[^a-zñ0-9]/g, "");
    if (!activo || !Ctor || !limpio) {
      setEstado("apagado");
      return;
    }

    const patron = new RegExp(`(^|[^a-z0-9])${limpio}(?![a-z0-9])`);
    let vivo = true;
    let rec: SpeechRecognition | null = null;
    let atentoHasta = 0;
    let ultimoHablar = 0;
    let timerAtento: ReturnType<typeof setTimeout> | undefined;
    let timerReinicio: ReturnType<typeof setTimeout> | undefined;

    const sondeo = setInterval(() => {
      if (window.speechSynthesis.speaking) ultimoHablar = Date.now();
    }, 150);

    function entrarAtento() {
      atentoHasta = Date.now() + VENTANA_ATENTO_MS;
      setEstado("atento");
      pitido();
      clearTimeout(timerAtento);
      timerAtento = setTimeout(() => {
        if (vivo) setEstado("esperando");
      }, VENTANA_ATENTO_MS);
    }

    function salirAtento() {
      atentoHasta = 0;
      clearTimeout(timerAtento);
      setEstado("esperando");
    }

    function procesar(texto: string) {
      if (Date.now() - ultimoHablar < SILENCIO_TRAS_HABLAR_MS) return; // era el propio asistente hablando
      setOido(texto);
      const m = patron.exec(plegar(texto));
      let comando: string | null = null;
      if (m) {
        comando = texto
          .slice(m.index + m[0].length)
          .replace(/^[\s,.:;¿?¡!-]+/, "")
          .trim();
        if (!comando) {
          entrarAtento();
          return;
        }
      } else if (Date.now() < atentoHasta) {
        comando = texto.trim();
      }
      if (comando) {
        salirAtento();
        onComandoRef.current(comando);
      }
    }

    function iniciar() {
      if (!vivo || !Ctor) return;
      rec = new Ctor();
      rec.lang = "es-CL";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) procesar(e.results[i][0].transcript);
        }
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          vivo = false;
          setEstado("error");
        }
      };
      rec.onend = () => {
        // Chrome corta la escucha continua cada tanto: se vuelve a abrir sola.
        if (vivo) timerReinicio = setTimeout(iniciar, 300);
      };
      try {
        rec.start();
        setEstado((e) => (e === "atento" ? e : "esperando"));
      } catch {
        // ya estaba iniciado
      }
    }

    iniciar();

    return () => {
      vivo = false;
      clearInterval(sondeo);
      clearTimeout(timerAtento);
      clearTimeout(timerReinicio);
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        try {
          rec.abort();
        } catch {
          // nada que cerrar
        }
      }
    };
  }, [activo, nombre]);

  return { estado, oido, disponible: Boolean(Ctor) };
}
