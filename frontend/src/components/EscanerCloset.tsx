import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CameraCapture } from "@/components/CameraCapture";
import { api, type PrendaDetectada } from "@/lib/api";

export function EscanerCloset() {
  const [escaneando, setEscaneando] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avisoCamara, setAvisoCamara] = useState("");
  const [estado, setEstado] = useState<"ok" | "revisar" | "error" | null>(null);
  const [disponibles, setDisponibles] = useState<PrendaDetectada[]>([]);
  const [dudosas, setDudosas] = useState<PrendaDetectada[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function procesarFoto(archivo: File) {
    setCargando(true);
    setMensaje("Mirando el closet...");
    setEstado(null);
    setDisponibles([]);
    setDudosas([]);
    try {
      const data = await api.escanearCloset(archivo);
      setDisponibles(data.disponibles);
      setDudosas(data.dudosas);
      setEstado(
        data.dudosas.length || data.disponibles.length === 0 ? "revisar" : "ok",
      );
      setMensaje(
        data.mensaje ||
          `${data.disponibles.length} disponibles, ${data.fuera.length} fuera del closet${
            data.dudosas.length ? `, ${data.dudosas.length} por confirmar` : ""
          }.`,
      );
    } catch (err) {
      setEstado("error");
      setMensaje((err as Error).message);
    } finally {
      setCargando(false);
      setEscaneando(false);
    }
  }

  async function resolverDudosa(p: PrendaDetectada, esta: boolean) {
    try {
      await api.confirmarDeteccion(p.prenda_id, esta);
      setDudosas((prev) => prev.filter((x) => x.prenda_id !== p.prenda_id));
      if (esta) setDisponibles((prev) => [...prev, p]);
    } catch (err) {
      setMensaje((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <a href="/" className="text-sm text-muted-foreground underline">
        ← Volver a mis prendas
      </a>
      <h1 className="text-xl font-semibold">Cámara del closet</h1>
      <p className="text-sm text-muted-foreground">
        Foto del closet con las prendas colgadas. Reviso cuáles están y cuáles
        no.
      </p>

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
      <Button
        type="button"
        variant="secondary"
        disabled={cargando}
        onClick={() => inputRef.current?.click()}
      >
        📷 Sacar foto / elegir archivo
      </Button>
      {avisoCamara && <p className="text-sm text-amber-600">{avisoCamara}</p>}

      {escaneando ? (
        <CameraCapture
          onCapture={procesarFoto}
          onCancel={() => setEscaneando(false)}
          onUnavailable={() =>
            setAvisoCamara(
              "No pude abrir la cámara en vivo (revisa el permiso del navegador). Usa el botón de arriba para sacar la foto.",
            )
          }
        />
      ) : (
        <Button
          type="button"
          onClick={() => setEscaneando(true)}
          disabled={cargando}
        >
          📷 Escanear el closet
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

      {disponibles.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Disponibles en el closet
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {disponibles.map((p) => (
              <Card key={p.prenda_id} className="overflow-hidden">
                <img
                  src={p.foto_path}
                  alt={p.tipo}
                  className="w-full h-20 object-cover"
                />
                <CardContent className="p-1.5 text-xs">
                  <strong>{p.tipo}</strong>
                  <br />
                  <span className="text-muted-foreground">{p.color}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {dudosas.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            ¿Está en el closet? (poca seguridad)
          </h2>
          <div className="flex flex-col gap-2">
            {dudosas.map((p) => (
              <Card key={p.prenda_id}>
                <CardContent className="flex items-center gap-3 p-2">
                  <img
                    src={p.foto_path}
                    alt={p.tipo}
                    className="w-14 h-14 object-cover rounded-md"
                  />
                  <div className="flex-1 text-sm">
                    <strong>{p.tipo}</strong> {p.color}
                    <br />
                    <span className="text-muted-foreground">
                      {Math.round((p.confianza ?? 0) * 100)}% seguro
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => resolverDudosa(p, true)}
                    >
                      Sí
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => resolverDudosa(p, false)}
                    >
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
