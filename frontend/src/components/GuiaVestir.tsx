import { useEffect, useState } from "react";
import { api, type Conjunto } from "@/lib/api";
import { hablar } from "@/lib/voz";
import { instruccion, ordenarParaVestir } from "@/lib/vestir";
import { Boton, ETIQUETA, VIDRIO } from "@/components/espejoUi";

const SEGMENTOS = 14;

async function tomarFoto(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 500)); // deja que la cámara ajuste la exposición
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo tomar la foto"))),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// Barra LED simulada: marca la zona donde estaría la prenda (hasta tener el tubo real y la posición de la cámara).
function BarraLed({ semilla }: { semilla: number }) {
  const inicio = (semilla * 37) % (SEGMENTOS - 2);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {Array.from({ length: SEGMENTOS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 transition-colors duration-500 ${
              i >= inicio && i < inicio + 3
                ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                : "bg-white/15"
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
        Luz del armario · simulada
      </p>
    </div>
  );
}

// Tras confirmar: guía prenda por prenda para vestirse, opinión opcional sobre cómo quedó y valoración que alimenta el aprendizaje.
export function GuiaVestir({
  conjunto,
  paso,
  onPaso,
  onCerrar,
  tono,
  nombre,
}: {
  conjunto: Conjunto;
  paso: number;
  onPaso: (n: number) => void;
  onCerrar: () => void;
  tono: string;
  nombre: string;
}) {
  const piezas = ordenarParaVestir(conjunto.piezas);
  const total = piezas.length;
  const final = paso >= total;
  const pieza = final ? null : piezas[paso];

  const [fase, setFase] = useState<
    "inicio" | "cuenta" | "analizando" | "listo" | "error"
  >("inicio");
  const [cuenta, setCuenta] = useState(0);
  const [opinion, setOpinion] = useState("");
  const [valorado, setValorado] = useState(false);

  useEffect(() => {
    hablar(
      pieza
        ? instruccion(pieza, paso)
        : "¡Listo! Si quieres, te doy mi opinión de cómo te quedó.",
    );
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pedirOpinion() {
    try {
      for (let n = 3; n > 0; n--) {
        setFase("cuenta");
        setCuenta(n);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setFase("analizando");
      const foto = await tomarFoto();
      const r = await api.opinionLook(
        foto,
        piezas.map((p) => `${p.tipo} ${p.color}`),
        tono,
        nombre,
      );
      setOpinion(r.opinion);
      setFase("listo");
      hablar(r.opinion);
    } catch {
      setFase("error");
    }
  }

  async function valorar(valor: -1 | 0 | 1) {
    setValorado(true);
    try {
      await api.valorarLook(conjunto.prenda_ids, valor);
    } catch {
      // la valoración es opcional; si falla no se bloquea al usuario
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <p className={ETIQUETA}>
        {final ? "Último paso" : `Vistiéndote · paso ${paso + 1} de ${total}`}
      </p>

      {pieza && (
        <>
          <div className={`${VIDRIO} p-3 flex flex-col gap-3`}>
            <img
              src={pieza.foto_path}
              alt={pieza.tipo}
              className="w-full h-64 object-cover"
            />
            <div>
              <p className="text-lg font-light tracking-wide">
                {pieza.tipo}{" "}
                <span className="text-white/60">· {pieza.color}</span>
              </p>
              <p className="text-[11px] text-white/60">
                {instruccion(pieza, paso)}
              </p>
            </div>
            <BarraLed semilla={pieza.id} />
          </div>
          <div className="flex gap-1.5">
            {piezas.map((_, i) => (
              <span
                key={i}
                className={`h-px flex-1 ${i <= paso ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <Boton primario onClick={() => onPaso(paso + 1)}>
              Listo, siguiente
            </Boton>
            {paso > 0 && <Boton onClick={() => onPaso(paso - 1)}>Atrás</Boton>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="self-start text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-white/60 hover:text-white"
          >
            Saltar guía
          </button>
        </>
      )}

      {final && (
        <div className={`${VIDRIO} p-4 flex flex-col gap-3`}>
          <p className="text-sm font-light">
            Ya estás listo. ¿Quieres mi opinión de cómo te quedó?
          </p>

          {fase === "inicio" && (
            <>
              <Boton onClick={pedirOpinion}>Tomar foto y opinar</Boton>
              <p className="text-[10px] text-white/50 leading-snug">
                Usa tu cámara una vez. La foto se analiza con IA y no se guarda.
              </p>
            </>
          )}
          {fase === "cuenta" && <p className="text-3xl font-light">{cuenta}</p>}
          {fase === "analizando" && (
            <p className={ETIQUETA}>Mirando tu look…</p>
          )}
          {fase === "error" && (
            <>
              <p className="text-sm text-amber-200">
                No pude tomar o analizar la foto.
              </p>
              <Boton pequeno onClick={pedirOpinion}>
                Reintentar
              </Boton>
            </>
          )}
          {fase === "listo" && (
            <p className="text-sm italic font-light text-white/90">{opinion}</p>
          )}

          <div className="border-t border-white/15 pt-3 flex flex-col gap-2">
            {valorado ? (
              <p className="text-xs text-white/70">
                Gracias, lo tendré en cuenta para tus próximos looks.
              </p>
            ) : (
              <>
                <p className={ETIQUETA}>¿Qué tal el look?</p>
                <div className="flex gap-2 flex-wrap">
                  <Boton pequeno onClick={() => valorar(1)}>
                    Me encanta
                  </Boton>
                  <Boton pequeno onClick={() => valorar(0)}>
                    Está bien
                  </Boton>
                  <Boton pequeno onClick={() => valorar(-1)}>
                    No me convenció
                  </Boton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {final && (
        <div className="flex gap-3">
          <Boton onClick={() => onPaso(total - 1)}>Atrás</Boton>
          <Boton primario onClick={onCerrar}>
            Terminar
          </Boton>
        </div>
      )}
    </div>
  );
}
