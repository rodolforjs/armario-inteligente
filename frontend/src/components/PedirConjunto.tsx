import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type Clima, type Conjunto, type Modo } from "@/lib/api";

const SpeechRecognitionCtor: typeof window.SpeechRecognition | undefined =
  window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

export function PedirConjunto() {
  const [modo, setModo] = useState<Modo>("exploratorio");
  const [ocasion, setOcasion] = useState("");
  const [textoLibre, setTextoLibre] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [clima, setClima] = useState<Clima | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [sesionId, setSesionId] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechRecognition | null>(null);

  function dictar() {
    if (!SpeechRecognitionCtor) return;
    const recognizer = new SpeechRecognitionCtor();
    recognizer.lang = "es-CL";
    recognizer.interimResults = false;
    recognizer.addEventListener("result", (e) => {
      const texto = e.results[0][0].transcript;
      setTextoLibre((prev) => (prev ? `${prev} ${texto}` : texto));
    });
    recognizer.addEventListener("end", () => setGrabando(false));
    recognizerRef.current = recognizer;
    setGrabando(true);
    recognizer.start();
  }

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setMensaje("Pensando en tu conjunto...");
    setConjuntos([]);
    try {
      const data = await api.pedirRecomendacion({ modo, ocasion: ocasion || null, texto_libre: textoLibre || null });
      setSesionId(data.sesion_id);
      setClima(data.clima);
      setConjuntos(data.conjuntos);
      setMensaje("");
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  async function aceptar(idx: number) {
    if (!sesionId) return;
    const sesion = await api.obtenerSesion(sesionId);
    const prendaIds = sesion.conjuntos[idx].prenda_ids;
    await api.aceptarConjunto(sesionId, prendaIds);
    setMensaje("¡Conjunto confirmado! Que lo disfrutes.");
    setConjuntos([]);
    setSesionId(null);
  }

  async function cambiarPrenda(idx: number, prendaId: number) {
    if (!sesionId) return;
    try {
      const data = await api.rechazarPrenda(sesionId, idx, prendaId);
      setConjuntos(data.conjuntos);
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    }
  }

  async function otrasOpciones() {
    if (!sesionId) return;
    setMensaje("Buscando otras opciones...");
    const data = await api.rechazarConjunto(sesionId);
    if (data.estado === "modo_libre") {
      setMensaje("Ya van 2 rechazos. Pasamos a modo libre: revisa el inventario y elige tú mismo.");
      setConjuntos([]);
      return;
    }
    setClima(data.clima ?? null);
    setConjuntos(data.conjuntos ?? []);
    setMensaje("");
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <form onSubmit={pedir} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Modo</Label>
          <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exploratorio">Exploratorio (3 opciones)</SelectItem>
              <SelectItem value="pocas_opciones">Pocas opciones (2)</SelectItem>
              <SelectItem value="preciso">Preciso (1 directo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Ocasión (opcional)</Label>
          <Select value={ocasion} onValueChange={setOcasion}>
            <SelectTrigger>
              <SelectValue placeholder="— sin especificar —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">casual</SelectItem>
              <SelectItem value="formal">formal</SelectItem>
              <SelectItem value="deportivo">deportivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="situacion">Cuéntame la situación (opcional)</Label>
          <div className="flex gap-2 items-start">
            <Textarea
              id="situacion"
              placeholder="ej. voy a una reunión importante pero quiero estar cómodo"
              value={textoLibre}
              onChange={(e) => setTextoLibre(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant={grabando ? "danger" : "outline"}
              onClick={dictar}
              disabled={!SpeechRecognitionCtor}
              title={SpeechRecognitionCtor ? "Dictar por voz" : "Tu navegador no soporta dictado por voz"}
            >
              🎤
            </Button>
          </div>
        </div>

        <Button type="submit" disabled={cargando}>
          Recomendarme algo
        </Button>
      </form>

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
      {clima && (
        <p className="text-sm">
          Santiago ahora: {clima.temperatura_c}°C, {clima.categoria}
          {clima.precipitacion_mm > 0 ? " (con lluvia)" : ""}
        </p>
      )}

      {conjuntos.map((c, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle>Conjunto {idx + 1}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto">
              {c.piezas.map((p) => (
                <img
                  key={p.id}
                  src={`/${p.foto_path}`}
                  alt={p.tipo}
                  title={`${p.tipo} (id ${p.id})`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ))}
            </div>
            <p className="italic text-muted-foreground">{c.razon}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => aceptar(idx)}>
                Confirmar este conjunto
              </Button>
              {c.piezas.map((p) => (
                <Button key={p.id} type="button" variant="outline" onClick={() => cambiarPrenda(idx, p.id)}>
                  Cambiar {p.tipo}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {conjuntos.length > 0 && (
        <Button type="button" variant="secondary" onClick={otrasOpciones}>
          Pedir otras opciones
        </Button>
      )}
    </div>
  );
}
