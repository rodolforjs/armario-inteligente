import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type Atributos, type Clima, type Conjunto, type Modo, type Prenda, type Zona } from "@/lib/api";

type Msg = { id: string; role: "bot" | "user"; node: React.ReactNode };

type Stage =
  | "menu"
  | "upload_select"
  | "upload_confirm"
  | "reco_modo"
  | "reco_ocasion"
  | "reco_texto"
  | "reco_loading"
  | "reco_result";

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
  const [stage, setStage] = useState<Stage>("menu");
  const [texto, setTexto] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // estado del flujo "subir prenda"
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atributos, setAtributos] = useState<Atributos>({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
  const [zonaActual, setZonaActual] = useState("");
  const [tagUid, setTagUid] = useState("");

  // estado del flujo "recomendación"
  const [modo, setModo] = useState<Modo | null>(null);
  const [ocasion, setOcasion] = useState<string | null>(null);
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [clima, setClima] = useState<Clima | null>(null);

  useEffect(() => {
    api.listarZonas().then(setZonas).catch(() => {});
    bot("¡Hola! Soy tu asistente de armario. ¿Qué necesitas hoy?");
    goMenu();
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

  function goMenu() {
    setStage("menu");
  }

  // ---------- Ruteo de texto libre en el menú ----------
  function interpretar(mensaje: string) {
    const t = mensaje.toLowerCase();
    if (/(subir|foto|prenda nueva|agregar)/.test(t)) return iniciarSubir();
    if (/(inventario|ropa que tengo|qué tengo|que tengo)/.test(t)) return verInventario();
    if (/(conjunto|recomien|qué me pongo|que me pongo|vestir)/.test(t)) return iniciarRecomendacion();
    bot("No estoy seguro de qué necesitas. Elige una opción:");
    setStage("menu");
  }

  function onEnviarComposer() {
    const valor = texto.trim();
    if (!valor) return;
    user(valor);
    setTexto("");
    if (stage === "menu") return interpretar(valor);
    if (stage === "reco_texto") return continuarRecomendacionConTexto(valor);
    interpretar(valor);
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

  // ---------- Flujo: subir prenda ----------
  function iniciarSubir() {
    bot("Perfecto, elige una foto de la prenda y la analizo.");
    setStage("upload_select");
  }

  async function analizarFoto() {
    const archivo = fileInputRef.current?.files?.[0];
    if (!archivo) {
      bot("Primero selecciona una foto.");
      return;
    }
    user("📷 (foto adjunta)");
    setBusy(true);
    bot("Analizando con IA...");
    try {
      const data = await api.subirFoto(archivo);
      setToken(data.token);
      setFotoUrl(data.foto_url);
      setAtributos(data.atributos);
      bot(
        data.ia_disponible
          ? "Esto identifiqué. Revisa y corrige si hace falta:"
          : "La IA no está disponible ahora — completa los datos a mano:",
      );
      setStage("upload_confirm");
    } catch (err) {
      bot(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function guardarPrenda() {
    if (!token) return;
    setBusy(true);
    try {
      await api.confirmarPrenda({ token, ...atributos, zona_actual: zonaActual || undefined, tag_uid: tagUid || undefined });
      user("Guardar");
      bot("Prenda guardada en tu inventario. ¿Algo más?");
      setToken(null);
      setFotoUrl(null);
      setAtributos({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
      setZonaActual("");
      setTagUid("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      goMenu();
    } catch (err) {
      bot(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Flujo: inventario ----------
  async function verInventario() {
    setBusy(true);
    try {
      const prendas = await api.listarPrendas();
      addMsg("bot", <InventarioGrid prendas={prendas} />);
      bot(prendas.length ? "¿Qué más necesitas?" : "Aún no tienes prendas — sube una foto cuando quieras.");
    } finally {
      setBusy(false);
      goMenu();
    }
  }

  // ---------- Flujo: recomendación ----------
  function iniciarRecomendacion() {
    bot("¿Cuántas opciones quieres ver?");
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

  async function continuarRecomendacionConTexto(textoLibre: string | null) {
    if (textoLibre) user(textoLibre);
    else user("Omitir");
    await pedirRecomendacion(textoLibre);
  }

  async function pedirRecomendacion(textoLibre: string | null) {
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
      goMenu();
    } finally {
      setBusy(false);
    }
  }

  async function aceptar(idx: number) {
    if (!sesionId) return;
    setBusy(true);
    try {
      const sesion = await api.obtenerSesion(sesionId);
      await api.aceptarConjunto(sesionId, sesion.conjuntos[idx].prenda_ids);
      user(`Confirmar conjunto ${idx + 1}`);
      bot("¡Listo, que lo disfrutes! ¿Algo más?");
      setConjuntos([]);
      setSesionId(null);
      goMenu();
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
        bot("Ya van 2 rechazos. Pasamos a modo libre: revisa tu inventario y elige tú mismo.");
        setConjuntos([]);
        goMenu();
        return;
      }
      setClima(data.clima ?? null);
      setConjuntos(data.conjuntos ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-screen p-4">
      <h1 className="text-xl font-semibold mb-3">Armario Inteligente</h1>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            {m.node}
          </Bubble>
        ))}

        {stage === "menu" && (
          <Chips
            options={[
              { label: "📷 Subir prenda", value: "subir" },
              { label: "👕 Ver inventario", value: "inventario" },
              { label: "✨ Pedir conjunto", value: "recomendar" },
            ]}
            onPick={(v) => {
              if (v === "subir") return iniciarSubir();
              if (v === "inventario") return verInventario();
              return iniciarRecomendacion();
            }}
          />
        )}

        {stage === "upload_select" && (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <Input ref={fileInputRef} type="file" accept="image/*" capture="environment" />
              <Button type="button" onClick={analizarFoto} disabled={busy}>
                Analizar con IA
              </Button>
            </CardContent>
          </Card>
        )}

        {stage === "upload_confirm" && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              {fotoUrl && <img src={fotoUrl} alt="preview" className="w-full max-h-56 object-cover rounded-lg" />}
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Input value={atributos.tipo} onChange={(e) => setAtributos({ ...atributos, tipo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <Input value={atributos.color} onChange={(e) => setAtributos({ ...atributos, color: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Formalidad</Label>
                <Select value={atributos.formalidad} onValueChange={(v) => setAtributos({ ...atributos, formalidad: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">casual</SelectItem>
                    <SelectItem value="formal">formal</SelectItem>
                    <SelectItem value="deportivo">deportivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Abrigo</Label>
                <Select value={atributos.abrigo} onValueChange={(v) => setAtributos({ ...atributos, abrigo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liviano">liviano</SelectItem>
                    <SelectItem value="medio">medio</SelectItem>
                    <SelectItem value="abrigado">abrigado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Zona (opcional)</Label>
                <Select value={zonaActual} onValueChange={setZonaActual}>
                  <SelectTrigger>
                    <SelectValue placeholder="— sin asignar —" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonas.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tag NFC (opcional)</Label>
                <Input value={tagUid} onChange={(e) => setTagUid(e.target.value)} />
              </div>
              <Button type="button" onClick={guardarPrenda} disabled={busy}>
                Guardar
              </Button>
            </CardContent>
          </Card>
        )}

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
                <Button type="button" variant="outline" onClick={() => continuarRecomendacionConTexto(null)} disabled={busy}>
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

      {(stage === "menu" || stage === "reco_texto") && (
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <Input
            placeholder="Escribe aquí..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnviarComposer()}
          />
          <Button type="button" onClick={onEnviarComposer} disabled={busy || !texto.trim()}>
            Enviar
          </Button>
        </div>
      )}
    </div>
  );
}

function InventarioGrid({ prendas }: { prendas: Prenda[] }) {
  if (!prendas.length) return <p>Todavía no hay prendas.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 max-w-xs">
      {prendas.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          <img src={`/${p.foto_path}`} alt={p.tipo} className="w-full h-20 object-cover" />
          <CardContent className="p-1.5 text-xs">
            <strong>{p.tipo}</strong>
            <br />
            {p.color}
            <br />
            <Badge variant={p.estado === "disponible" ? "olive" : "yellow"} className="mt-1">
              {p.estado}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
