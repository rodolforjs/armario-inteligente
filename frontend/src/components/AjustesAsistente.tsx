import { useEffect, useState } from "react";
import { ETIQUETA } from "@/components/espejoUi";
import { hablar, vocesEnEspanol, type AjustesVoz } from "@/lib/voz";

export const TONOS = [
  { id: "cercano", etiqueta: "Cercano" },
  { id: "formal", etiqueta: "Formal" },
  { id: "divertido", etiqueta: "Divertido" },
  { id: "breve", etiqueta: "Breve" },
];

const CAMPO =
  "bg-transparent border border-white/40 px-2 py-1.5 text-xs outline-none focus:border-white w-full";

// Personalización del asistente: nombre, tono de la conversación y voz (todo gratis, con las voces del navegador).
export function AjustesAsistente({
  nombre,
  onNombre,
  tono,
  onTono,
  voz,
  onVoz,
  oido,
  escuchaDisponible,
}: {
  nombre: string;
  onNombre: (n: string) => void;
  tono: string;
  onTono: (t: string) => void;
  voz: AjustesVoz;
  onVoz: (v: AjustesVoz) => void;
  oido: string;
  escuchaDisponible: boolean;
}) {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>(() =>
    vocesEnEspanol(),
  );

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const actualizar = () => setVoces(vocesEnEspanol());
    actualizar();
    window.speechSynthesis.addEventListener("voiceschanged", actualizar);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", actualizar);
  }, []);

  return (
    <div className="mt-auto flex flex-col gap-2 pb-2">
      <p className={ETIQUETA}>Asistente · personalizar</p>
      <input
        value={nombre}
        onChange={(e) => onNombre(e.target.value)}
        maxLength={20}
        aria-label="Nombre del asistente"
        className={CAMPO}
      />
      <select
        value={tono}
        onChange={(e) => onTono(e.target.value)}
        aria-label="Tono"
        className={`${CAMPO} bg-neutral-900`}
      >
        {TONOS.map((t) => (
          <option key={t.id} value={t.id}>
            Tono: {t.etiqueta}
          </option>
        ))}
      </select>
      <select
        value={voz.voz}
        onChange={(e) => onVoz({ ...voz, voz: e.target.value })}
        aria-label="Voz"
        className={`${CAMPO} bg-neutral-900`}
      >
        <option value="">Voz: automática</option>
        {voces.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <span className="w-14">Velocidad</span>
        <input
          type="range"
          min={0.7}
          max={1.4}
          step={0.05}
          value={voz.velocidad}
          onChange={(e) => onVoz({ ...voz, velocidad: Number(e.target.value) })}
          className="flex-1"
        />
      </label>
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <span className="w-14">Tono voz</span>
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={voz.tono}
          onChange={(e) => onVoz({ ...voz, tono: Number(e.target.value) })}
          className="flex-1"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          hablar(`Hola, soy ${nombre}. Así sueno.`, undefined, voz)
        }
        className="self-start text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/80 hover:text-white"
      >
        Probar voz
      </button>
      <p className="text-[11px] text-white/50 leading-snug">
        {escuchaDisponible
          ? oido
            ? `Oído: “${oido}”`
            : "Activa “Llamar” y di el nombre; verás aquí lo que entiende."
          : "Este navegador no permite escucha continua."}
      </p>
    </div>
  );
}
