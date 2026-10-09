const SpeechRecognitionCtor: typeof window.SpeechRecognition | undefined =
  window.SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

export const vozDisponible = Boolean(SpeechRecognitionCtor);

export type AjustesVoz = { voz: string; velocidad: number; tono: number };

export const AJUSTES_VOZ_BASE: AjustesVoz = { voz: "", velocidad: 1, tono: 1 };
const CLAVE_AJUSTES = "espejo.vozAjustes";

export function leerAjustesVoz(): AjustesVoz {
  try {
    return { ...AJUSTES_VOZ_BASE, ...JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}") };
  } catch {
    return AJUSTES_VOZ_BASE;
  }
}

export function guardarAjustesVoz(ajustes: AjustesVoz) {
  try {
    localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes));
  } catch {
    // sin almacenamiento: vale solo esta sesión
  }
}

// Las voces gratis que trae el navegador/sistema. Las "Natural" (Edge) y "Google" suenan mucho mejor que las locales.
export function vocesEnEspanol(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  const puntaje = (v: SpeechSynthesisVoice) =>
    (/natural|neural/i.test(v.name) ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0) + (v.lang.toLowerCase() === "es-cl" ? 1 : 0);
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .sort((a, b) => puntaje(b) - puntaje(a));
}

export function hablar(texto: string, onFin?: () => void, ajustes: AjustesVoz = leerAjustesVoz()) {
  if (!("speechSynthesis" in window)) {
    onFin?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "es-CL";
  const elegida = vocesEnEspanol().find((v) => v.voiceURI === ajustes.voz) ?? vocesEnEspanol()[0];
  if (elegida) {
    utterance.voice = elegida;
    utterance.lang = elegida.lang;
  }
  utterance.rate = ajustes.velocidad;
  utterance.pitch = ajustes.tono;
  if (onFin) {
    utterance.onend = onFin;
    utterance.onerror = onFin;
  }
  window.speechSynthesis.speak(utterance);
}

export function callar() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function escuchar(onResultado: (texto: string) => void, onFin: () => void) {
  if (!SpeechRecognitionCtor) return;
  window.speechSynthesis.cancel();
  const recognizer = new SpeechRecognitionCtor();
  recognizer.lang = "es-CL";
  recognizer.interimResults = false;
  recognizer.addEventListener("result", (e) => {
    onResultado(e.results[0][0].transcript);
  });
  recognizer.addEventListener("end", onFin);
  recognizer.start();
}
