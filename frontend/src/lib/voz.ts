const SpeechRecognitionCtor: typeof window.SpeechRecognition | undefined =
  window.SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

export const vozDisponible = Boolean(SpeechRecognitionCtor);

export function hablar(texto: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "es-CL";
  window.speechSynthesis.speak(utterance);
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
