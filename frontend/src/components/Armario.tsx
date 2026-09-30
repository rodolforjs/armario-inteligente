import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture } from "@/components/CameraCapture";
import { api, type Atributos, type Clima, type Conjunto, type Prenda } from "@/lib/api";

type ModoCaptura = "camara" | "archivo" | null;

export function Armario() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atributos, setAtributos] = useState<Atributos>({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });

  const [sesionId, setSesionId] = useState<string | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [clima, setClima] = useState<Clima | null>(null);
  const [buscandoCombinaciones, setBuscandoCombinaciones] = useState(false);
  const [avisoCombinaciones, setAvisoCombinaciones] = useState("");

  function cargar() {
    setCargando(true);
    api
      .listarPrendas()
      .then(setPrendas)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  function cerrarCaptura() {
    setModoCaptura(null);
    setToken(null);
    setFotoUrl(null);
    setAtributos({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
    setMensaje("");
  }

  async function procesarFoto(archivo: File) {
    setCargando(true);
    setMensaje("Analizando con IA...");
    try {
      const data = await api.subirFoto(archivo);
      setToken(data.token);
      setFotoUrl(data.foto_url);
      setAtributos(data.atributos);
      setMensaje(
        data.ia_disponible
          ? "Revisa y corrige los atributos si hace falta."
          : "La IA no está disponible ahora mismo — completa los atributos a mano.",
      );
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  async function guardarPrenda(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCargando(true);
    try {
      await api.confirmarPrenda({ token, ...atributos });
      cerrarCaptura();
      cargar();
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  async function verCombinaciones() {
    setBuscandoCombinaciones(true);
    setAvisoCombinaciones("");
    setConjuntos([]);
    try {
      const data = await api.pedirRecomendacion({ modo: "exploratorio", ocasion: null, texto_libre: null });
      setSesionId(data.sesion_id);
      setClima(data.clima);
      setConjuntos(data.conjuntos);
    } catch (err) {
      setAvisoCombinaciones(`Error: ${(err as Error).message}`);
    } finally {
      setBuscandoCombinaciones(false);
    }
  }

  async function aceptar(idx: number) {
    if (!sesionId) return;
    setBuscandoCombinaciones(true);
    try {
      const sesion = await api.obtenerSesion(sesionId);
      await api.aceptarConjunto(sesionId, sesion.conjuntos[idx].prenda_ids);
      setAvisoCombinaciones("¡Conjunto confirmado! Que lo disfrutes.");
      setConjuntos([]);
      setSesionId(null);
      cargar();
    } finally {
      setBuscandoCombinaciones(false);
    }
  }

  async function cambiarPrenda(idx: number, prendaId: number) {
    if (!sesionId) return;
    setBuscandoCombinaciones(true);
    try {
      const data = await api.rechazarPrenda(sesionId, idx, prendaId);
      setConjuntos(data.conjuntos);
    } catch (err) {
      setAvisoCombinaciones(`Error: ${(err as Error).message}`);
    } finally {
      setBuscandoCombinaciones(false);
    }
  }

  async function otrasOpciones() {
    if (!sesionId) return;
    setBuscandoCombinaciones(true);
    try {
      const data = await api.rechazarConjunto(sesionId);
      if (data.estado === "modo_libre") {
        setAvisoCombinaciones("Ya van 2 rechazos. Elige tú mismo desde tu armario esta vez.");
        setConjuntos([]);
        setSesionId(null);
        return;
      }
      setClima(data.clima ?? null);
      setConjuntos(data.conjuntos ?? []);
    } finally {
      setBuscandoCombinaciones(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Armario Inteligente</h1>

      {/* ---------- Captura ---------- */}
      {modoCaptura === null && !token && (
        <Button type="button" size="lg" onClick={() => setModoCaptura("camara")} className="w-full">
          📷 Sacar foto de una prenda
        </Button>
      )}

      {modoCaptura === "camara" && !token && (
        <CameraCapture
          onCapture={procesarFoto}
          onCancel={cerrarCaptura}
          onUnavailable={() => setModoCaptura("archivo")}
        />
      )}

      {modoCaptura === "archivo" && !token && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <p className="text-xs text-muted-foreground">
              La cámara en vivo no está disponible en esta conexión (necesita HTTPS). Usa el selector de tu teléfono:
            </p>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && procesarFoto(e.target.files[0])}
            />
            <Button type="button" variant="outline" onClick={cerrarCaptura} className="w-fit">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {token && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {fotoUrl && <img src={fotoUrl} alt="preview" className="w-full max-h-64 object-cover rounded-lg" />}
            <form onSubmit={guardarPrenda} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Input required value={atributos.tipo} onChange={(e) => setAtributos({ ...atributos, tipo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <Input required value={atributos.color} onChange={(e) => setAtributos({ ...atributos, color: e.target.value })} />
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
              <div className="flex gap-2">
                <Button type="submit" disabled={cargando} className="flex-1">
                  Guardar
                </Button>
                <Button type="button" variant="outline" onClick={cerrarCaptura}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ---------- Galería ---------- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-sm text-muted-foreground">Tu ropa ({prendas.length})</h2>
          <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            Refrescar
          </Button>
        </div>
        {prendas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aún no has subido ninguna prenda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {prendas.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <img src={p.foto_path} alt={p.tipo} className="w-full h-24 object-cover" />
                <CardContent className="p-1.5 text-xs">
                  <strong>{p.tipo}</strong>
                  <br />
                  <Badge variant={p.estado === "disponible" ? "olive" : "yellow"} className="mt-1">
                    {p.estado}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Combinaciones ---------- */}
      <div className="flex flex-col gap-3">
        <Button type="button" size="lg" onClick={verCombinaciones} disabled={buscandoCombinaciones || prendas.length === 0}>
          ✨ Ver combinaciones
        </Button>
        {avisoCombinaciones && <p className="text-sm text-muted-foreground">{avisoCombinaciones}</p>}
        {clima && conjuntos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Santiago ahora: {clima.temperatura_c}°C, {clima.categoria}
            {clima.precipitacion_mm > 0 ? " (con lluvia)" : ""}
          </p>
        )}
        {conjuntos.map((c, idx) => (
          <Card key={idx}>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex gap-2 overflow-x-auto">
                {c.piezas.map((p) => (
                  <img key={p.id} src={p.foto_path} alt={p.tipo} className="w-20 h-20 object-cover rounded-lg" />
                ))}
              </div>
              <p className="italic text-sm text-muted-foreground">{c.razon}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => aceptar(idx)} disabled={buscandoCombinaciones}>
                  Confirmar
                </Button>
                {c.piezas.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cambiarPrenda(idx, p.id)}
                    disabled={buscandoCombinaciones}
                  >
                    Cambiar {p.tipo}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {conjuntos.length > 0 && (
          <Button type="button" variant="secondary" onClick={otrasOpciones} disabled={buscandoCombinaciones}>
            Pedir otras opciones
          </Button>
        )}
      </div>
    </div>
  );
}
