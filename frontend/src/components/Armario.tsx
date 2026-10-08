import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture, type CameraCaptureHandle } from "@/components/CameraCapture";
import { DetallePrenda } from "@/components/DetallePrenda";
import { PantallaExito } from "@/components/PantallaExito";
import { useAsistenteVoz } from "@/hooks/useAsistenteVoz";
import { useCombinaciones } from "@/hooks/useCombinaciones";
import { api, type Atributos, type Prenda } from "@/lib/api";
import { mensajeAmigable } from "@/lib/errores";

type ModoCaptura = "camara" | "archivo" | null;

export function Armario() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>(null);
  const [fotoListaParaUsar, setFotoListaParaUsar] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atributos, setAtributos] = useState<Atributos>({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
  const [extras, setExtras] = useState({ marca: "", material: "", temporada: "" });
  const cameraRef = useRef<CameraCaptureHandle>(null);
  const [prendaSeleccionada, setPrendaSeleccionada] = useState<Prenda | null>(null);

  const {
    conjuntos,
    clima,
    buscando: buscandoCombinaciones,
    aviso: avisoCombinaciones,
    confirmado,
    verCombinaciones,
    aceptar,
    cambiarPrenda,
    otrasOpciones,
    reiniciar: reiniciarCombinaciones,
    cerrarConfirmacion,
  } = useCombinaciones();

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
    setFotoListaParaUsar(false);
    setToken(null);
    setFotoUrl(null);
    setAtributos({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
    setExtras({ marca: "", material: "", temporada: "" });
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
      setMensaje(mensajeAmigable((err as Error).message));
    } finally {
      setCargando(false);
    }
  }

  async function guardarPrenda(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return;
    setCargando(true);
    try {
      await api.confirmarPrenda({ token, ...atributos, ...extras });
      cerrarCaptura();
      cargar();
      reiniciarHistorial();
    } catch (err) {
      setMensaje(mensajeAmigable((err as Error).message));
    } finally {
      setCargando(false);
    }
  }

  // ---------- Asistente de voz ----------
  function etapaActual(): string {
    if (token) return "confirmando_atributos";
    if (modoCaptura === "camara" && fotoListaParaUsar) return "foto_capturada";
    if (modoCaptura === "camara" || modoCaptura === "archivo") return "camara_abierta";
    if (conjuntos.length > 0) return "mostrando_combinaciones";
    return "inicio";
  }

  const { escuchando, transcripcion, respuestaAsistente, alMicrofono, reiniciarHistorial, vozDisponible } = useAsistenteVoz({
    etapaActual,
    contextoExtra: () => ({
      atributos_detectados: token ? atributos : undefined,
      piezas_conjunto: conjuntos[0]?.piezas.map((p) => p.tipo) ?? [],
      cantidad_prendas_en_armario: prendas.length,
    }),
    onAccion: (resp, texto) => {
      switch (resp.accion) {
        case "abrir_camara":
          setModoCaptura("camara");
          break;
        case "capturar_foto":
          cameraRef.current?.capturar();
          break;
        case "usar_foto":
          cameraRef.current?.usarFoto();
          break;
        case "repetir_foto":
          cameraRef.current?.repetir();
          break;
        case "cancelar":
          cerrarCaptura();
          reiniciarCombinaciones();
          reiniciarHistorial();
          break;
        case "guardar_prenda":
          guardarPrenda();
          break;
        case "ver_combinaciones":
          verCombinaciones("preciso", resp.ocasion ?? null, texto);
          break;
        case "confirmar_conjunto":
          aceptar(0, cargar);
          reiniciarHistorial();
          break;
        case "cambiar_prenda": {
          const tipoBuscado = (resp.parametro || "").toLowerCase();
          const pieza = conjuntos[0]?.piezas.find((p) => p.tipo.toLowerCase().includes(tipoBuscado));
          if (pieza) cambiarPrenda(0, pieza.id);
          break;
        }
        case "otras_opciones":
          otrasOpciones();
          break;
      }
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Armario Inteligente</h1>

      {confirmado ? (
        <PantallaExito conjunto={confirmado} onCerrar={cerrarConfirmacion} />
      ) : (
        <>
          {/* ---------- Asistente de voz ---------- */}
          <Card>
            <CardContent className="flex flex-col items-center gap-2 pt-4">
              <Button
                type="button"
                size="lg"
                onClick={alMicrofono}
                disabled={!vozDisponible || escuchando}
                variant={escuchando ? "danger" : "default"}
                className="rounded-full w-20 h-20 text-3xl"
              >
                🎙️
              </Button>
              <p className="text-xs text-muted-foreground">
                {!vozDisponible
                  ? "Tu navegador no soporta voz — usa los botones de abajo."
                  : escuchando
                    ? "Escuchando..."
                    : "Toca y habla"}
              </p>
              {transcripcion && <p className="text-sm">Tú: "{transcripcion}"</p>}
              {respuestaAsistente && <p className="text-sm text-muted-foreground italic">Asistente: {respuestaAsistente}</p>}
            </CardContent>
          </Card>

          {/* ---------- Captura ---------- */}
          {modoCaptura === null && !token && (
            <Button type="button" size="lg" onClick={() => setModoCaptura("camara")} className="w-full">
              📷 Sacar foto de una prenda
            </Button>
          )}
          {modoCaptura === null && !token && (
            <Button type="button" size="lg" variant="outline" onClick={() => (window.location.href = "/escaner")} className="w-full">
              🗄️ Escanear el perchero
            </Button>
          )}

          {modoCaptura === "camara" && !token && (
            <CameraCapture
              ref={cameraRef}
              onCapture={procesarFoto}
              onCancel={cerrarCaptura}
              onUnavailable={() => setModoCaptura("archivo")}
              onEstadoFoto={setFotoListaParaUsar}
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
                  <div className="flex flex-col gap-1.5">
                    <Label>Marca (opcional)</Label>
                    <Input value={extras.marca} onChange={(e) => setExtras({ ...extras, marca: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Material (opcional)</Label>
                    <Input
                      value={extras.material}
                      onChange={(e) => setExtras({ ...extras, material: e.target.value })}
                      placeholder="ej. algodón, denim, lana"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Temporada (opcional)</Label>
                    <Select value={extras.temporada || "ninguna"} onValueChange={(v) => setExtras({ ...extras, temporada: v === "ninguna" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="— sin especificar —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguna">— sin especificar —</SelectItem>
                        <SelectItem value="verano">verano</SelectItem>
                        <SelectItem value="invierno">invierno</SelectItem>
                        <SelectItem value="entretiempo">entretiempo</SelectItem>
                        <SelectItem value="todo_el_ano">todo el año</SelectItem>
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
                  <Card
                    key={p.id}
                    className="overflow-hidden cursor-pointer"
                    onClick={() => setPrendaSeleccionada(p)}
                  >
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
            <Button
              type="button"
              size="lg"
              onClick={() => verCombinaciones("exploratorio")}
              disabled={buscandoCombinaciones || prendas.length === 0}
            >
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
                    <Button type="button" size="sm" onClick={() => aceptar(idx, cargar)} disabled={buscandoCombinaciones}>
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
        </>
      )}

      {prendaSeleccionada && (
        <DetallePrenda
          prenda={prendaSeleccionada}
          onCerrar={() => setPrendaSeleccionada(null)}
          onGuardado={() => {
            cargar();
            setPrendaSeleccionada(null);
          }}
        />
      )}
    </div>
  );
}
