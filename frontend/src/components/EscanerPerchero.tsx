import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture } from "@/components/CameraCapture";
import { api, type DeteccionPerchero } from "@/lib/api";

type CamaraId = "izquierda" | "derecha" | "unica";

export function EscanerPerchero() {
  const [camaraId, setCamaraId] = useState<CamaraId>("unica");
  const [escaneando, setEscaneando] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avisoCamara, setAvisoCamara] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"ok" | "revisar" | "error" | null>(null);
  const [confirmadas, setConfirmadas] = useState<DeteccionPerchero[]>([]);
  const [pendientes, setPendientes] = useState<DeteccionPerchero[]>([]);

  async function procesarFoto(archivo: File) {
    setCargando(true);
    setMensaje("Analizando el perchero...");
    setEstado(null);
    setConfirmadas([]);
    setPendientes([]);
    try {
      const data = await api.escanearPerchero(archivo, camaraId);
      setConfirmadas(data.confirmadas);
      setPendientes(data.pendientes);
      setEstado(data.pendientes.length || data.confirmadas.length === 0 ? "revisar" : "ok");
      setMensaje(
        data.mensaje ||
          `${data.confirmadas.length} confirmadas automáticamente, ${data.pendientes.length} necesitan que confirmes.`,
      );
    } catch (err) {
      setEstado("error");
      setMensaje((err as Error).message);
    } finally {
      setCargando(false);
      setEscaneando(false);
    }
  }

  async function resolverPendiente(p: DeteccionPerchero, aceptar: boolean) {
    try {
      await api.confirmarDeteccion(p.prenda_id, aceptar ? p.zona_sugerida : null);
      setPendientes((prev) => prev.filter((x) => x.prenda_id !== p.prenda_id));
      if (aceptar) setConfirmadas((prev) => [...prev, p]);
    } catch (err) {
      setMensaje((err as Error).message);
    }
  }

  function escanearDeNuevo() {
    setEscaneando(true);
    setMensaje("");
    setEstado(null);
  }

  return (
    <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Escáner de perchero</h1>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">Esta cámara está en el extremo:</label>
        <Select value={camaraId} onValueChange={(v) => setCamaraId(v as CamaraId)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="izquierda">Izquierdo</SelectItem>
            <SelectItem value="derecha">Derecho</SelectItem>
            <SelectItem value="unica">Única cámara (ve todo el perchero)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) procesarFoto(f);
        }}
      />
      <Button type="button" variant="secondary" disabled={cargando} onClick={() => inputRef.current?.click()}>
        📷 Sacar foto / elegir archivo
      </Button>
      {avisoCamara && <p className="text-sm text-amber-600">{avisoCamara}</p>}

      {escaneando ? (
        <CameraCapture
          onCapture={procesarFoto}
          onCancel={() => setEscaneando(false)}
          onUnavailable={() =>
            setAvisoCamara("No pude abrir la cámara en vivo (revisa el permiso del navegador). Usa el botón de abajo para sacar la foto.")
          }
        />
      ) : (
        <Button type="button" onClick={escanearDeNuevo} disabled={cargando}>
          📷 Escanear el perchero
        </Button>
      )}

      {cargando && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {!cargando && estado === "ok" && (
        <div className="rounded-xl bg-green-600 text-white p-4 text-center">
          <div className="text-3xl">✅ Bien</div>
          <p className="text-sm mt-1">{mensaje}</p>
        </div>
      )}
      {!cargando && estado === "revisar" && (
        <div className="rounded-xl bg-amber-500 text-white p-4 text-center">
          <div className="text-2xl">⚠️ Revisar</div>
          <p className="text-sm mt-1">{mensaje}</p>
        </div>
      )}
      {!cargando && estado === "error" && (
        <div className="rounded-xl bg-red-600 text-white p-4 text-center">
          <div className="text-2xl">❌ Error</div>
          <p className="text-sm mt-1">{mensaje}</p>
        </div>
      )}

      {confirmadas.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Confirmadas automáticamente</h2>
          <div className="grid grid-cols-3 gap-2">
            {confirmadas.map((p) => (
              <Card key={p.prenda_id} className="overflow-hidden">
                <img src={p.foto_path} alt={p.tipo} className="w-full h-20 object-cover" />
                <CardContent className="p-1.5 text-xs">
                  <strong>{p.tipo}</strong>
                  <br />
                  <span className="text-muted-foreground">{p.zona_sugerida}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">¿Es correcto? (confianza media/baja)</h2>
          <div className="flex flex-col gap-2">
            {pendientes.map((p) => (
              <Card key={p.prenda_id}>
                <CardContent className="flex items-center gap-3 p-2">
                  <img src={p.foto_path} alt={p.tipo} className="w-14 h-14 object-cover rounded-md" />
                  <div className="flex-1 text-sm">
                    <strong>{p.tipo}</strong>
                    <br />
                    <span className="text-muted-foreground">
                      zona sugerida: {p.zona_sugerida ?? "—"} · {Math.round(p.confianza * 100)}% seguro
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" onClick={() => resolverPendiente(p, true)}>
                      Sí
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => resolverPendiente(p, false)}>
                      No
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
