import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, type Clima, type Conjunto, type Modo } from "@/lib/api";

type Msg = { id: string; role: "bot" | "user"; node: React.ReactNode };

type Stage = "reco_modo" | "reco_ocasion" | "reco_texto" | "reco_loading" | "reco_result";

const SpeechRecognitionCtor: typeof window.SpeechRecognition | undefined =
  window.SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

function Bubble({ role, children }: { role: "bot" | "user"; children: React.ReactNode }) {
  const isBot = role === "bot";
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isBot ? "bg-[var(--v-beige)] text-[color:var(--v-text)]" : "bg-[var(--v-pink)] text-[color:var(--v-on-accent)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Chips({ options, onPick }: { options: { label: string; value: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.value} type="button" variant="outline" size="sm" onClick={() => onPick(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function ChatApp() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>("reco_modo");
  const [texto, setTexto] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [modo, setModo] = useState<Modo | null>(null);
  const [ocasion, setOcasion] = useState<string | null>(null);
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [clima, setClima] = useState<Clima | null>(null);

  useEffect(() => {
    bot("¡Hola! Soy tu asistente de estilo. ¿Cuántas opciones quieres ver?");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stage]);

  function addMsg(role: "bot" | "user", node: React.ReactNode) {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, node }]);
  }
  function bot(text: string) {
    addMsg("bot", text);
  }
  function user(text: string) {
    addMsg("user", text);
  }

  function reiniciar() {
    setModo(null);
    setOcasion(null);
    setSesionId(null);
    setConjuntos([]);
    setClima(null);
    bot("¿Cuántas opciones quieres ver esta vez?");
    setStage("reco_modo");
  }

  function elegirModo(m: string) {
    const modoElegido = m as Modo;
    setModo(modoElegido);
    const label = { exploratorio: "Exploratorio (3 opciones)", pocas_opciones: "Pocas opciones (2)", preciso: "Preciso (1 directo)" }[
      modoElegido
    ];
    user(label);
    bot("¿Para qué ocasión?");
    setStage("reco_ocasion");
  }

  function elegirOcasion(o: string) {
    const val = o === "omitir" ? null : o;
    setOcasion(val);
    user(val ?? "Sin especificar");
    bot("Cuéntame la situación con tus palabras (o toca omitir).");
    setStage("reco_texto");
  }

  async function continuarConTexto(textoLibre: string | null) {
    if (textoLibre) user(textoLibre);
    else user("Omitir");
    setTexto("");
    setStage("reco_loading");
    setBusy(true);
    bot("Pensando en tu conjunto...");
    try {
      const data = await api.pedirRecomendacion({ modo: modo ?? "exploratorio", ocasion, texto_libre: textoLibre });
      setSesionId(data.sesion_id);
      setClima(data.clima);
      setConjuntos(data.conjuntos);
      setStage("reco_result");
    } catch (err) {
      bot(`Error: ${(err as Error).message}`);
      reiniciar();
    } finally {
      setBusy(false);
    }
  }

  function onEnviarComposer() {
    const valor = texto.trim();
    if (!valor || stage !== "reco_texto") return;
    continuarConTexto(valor);
  }

  function dictar() {
    if (!SpeechRecognitionCtor) return;
    const recognizer = new SpeechRecognitionCtor();
    recognizer.lang = "es-CL";
    recognizer.interimResults = false;
    recognizer.addEventListener("result", (e) => {
      setTexto((prev) => (prev ? `${prev} ${e.results[0][0].transcript}` : e.results[0][0].transcript));
    });
    recognizer.addEventListener("end", () => setGrabando(false));
    setGrabando(true);
    recognizer.start();
  }

  async function aceptar(idx: number) {
    if (!sesionId) return;
    setBusy(true);
    try {
      const sesion = await api.obtenerSesion(sesionId);
      await api.aceptarConjunto(sesionId, sesion.conjuntos[idx].prenda_ids);
      user(`Confirmar conjunto ${idx + 1}`);
      bot("¡Listo, que lo disfrutes! ¿Quieres pedir otra idea?");
      setConjuntos([]);
      reiniciar();
    } finally {
      setBusy(false);
    }
  }

  async function cambiarPrenda(idx: number, prendaId: number, tipo: string) {
    if (!sesionId) return;
    setBusy(true);
    try {
      user(`Cambiar ${tipo}`);
      const data = await api.rechazarPrenda(sesionId, idx, prendaId);
      setConjuntos(data.conjuntos);
    } catch (err) {
      bot(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function otrasOpciones() {
    if (!sesionId) return;
    setBusy(true);
    user("Pedir otras opciones");
    bot("Buscando otras opciones...");
    try {
      const data = await api.rechazarConjunto(sesionId);
      if (data.estado === "modo_libre") {
        bot("Ya van 2 rechazos. Mejor revisa tu armario y elige tú mismo esta vez.");
        setConjuntos([]);
        reiniciar();
        return;
      }
      setClima(data.clima ?? null);
      setConjuntos(data.conjuntos ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-full p-4">
      <h1 className="text-xl font-semibold mb-3">Pedir una idea</h1>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            {m.node}
          </Bubble>
        ))}

        {stage === "reco_modo" && (
          <Chips
            options={[
              { label: "Exploratorio (3)", value: "exploratorio" },
              { label: "Pocas opciones (2)", value: "pocas_opciones" },
              { label: "Preciso (1)", value: "preciso" },
            ]}
            onPick={elegirModo}
          />
        )}

        {stage === "reco_ocasion" && (
          <Chips
            options={[
              { label: "Casual", value: "casual" },
              { label: "Formal", value: "formal" },
              { label: "Deportivo", value: "deportivo" },
              { label: "Omitir", value: "omitir" },
            ]}
            onPick={elegirOcasion}
          />
        )}

        {stage === "reco_texto" && (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="ej. voy a una reunión importante pero quiero estar cómodo"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant={grabando ? "danger" : "outline"}
                  onClick={dictar}
                  disabled={!SpeechRecognitionCtor}
                >
                  🎤
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={onEnviarComposer} disabled={busy || !texto.trim()}>
                  Enviar
                </Button>
                <Button type="button" variant="outline" onClick={() => continuarConTexto(null)} disabled={busy}>
                  Omitir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "reco_result" && (
          <>
            {clima && (
              <p className="text-xs text-muted-foreground px-1">
                Santiago ahora: {clima.temperatura_c}°C, {clima.categoria}
                {clima.precipitacion_mm > 0 ? " (con lluvia)" : ""}
              </p>
            )}
            {conjuntos.map((c, idx) => (
              <Card key={idx}>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <div className="flex gap-2 overflow-x-auto">
                    {c.piezas.map((p) => (
                      <img key={p.id} src={`/${p.foto_path}`} alt={p.tipo} className="w-20 h-20 object-cover rounded-lg" />
                    ))}
                  </div>
                  <p className="italic text-sm text-muted-foreground">{c.razon}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => aceptar(idx)} disabled={busy}>
                      Confirmar
                    </Button>
                    {c.piezas.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cambiarPrenda(idx, p.id, p.tipo)}
                        disabled={busy}
                      >
                        Cambiar {p.tipo}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button type="button" variant="secondary" onClick={otrasOpciones} disabled={busy}>
              Pedir otras opciones
            </Button>
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
