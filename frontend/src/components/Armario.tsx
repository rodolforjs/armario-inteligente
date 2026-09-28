import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Atributos, type Prenda, type Zona } from "@/lib/api";

export function Armario() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atributos, setAtributos] = useState<Atributos>({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
  const [zonaActual, setZonaActual] = useState("");
  const [tagUid, setTagUid] = useState("");

  function cargar() {
    setCargando(true);
    api
      .listarPrendas()
      .then(setPrendas)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    api.listarZonas().then(setZonas).catch(() => {});
  }, []);

  function abrirForm() {
    setMostrarForm(true);
    setMensaje("");
  }

  function cerrarForm() {
    setMostrarForm(false);
    setToken(null);
    setFotoUrl(null);
    setAtributos({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
    setZonaActual("");
    setTagUid("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function analizar() {
    const archivo = fileInputRef.current?.files?.[0];
    if (!archivo) {
      setMensaje("Primero selecciona o toma una foto.");
      return;
    }
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

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCargando(true);
    try {
      await api.confirmarPrenda({ token, ...atributos, zona_actual: zonaActual || undefined, tag_uid: tagUid || undefined });
      cerrarForm();
      cargar();
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tu armario</h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            Refrescar
          </Button>
          {!mostrarForm && (
            <Button type="button" size="sm" onClick={abrirForm}>
              + Agregar prenda
            </Button>
          )}
        </div>
      </div>

      {mostrarForm && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {!token && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input ref={fileInputRef} type="file" accept="image/*" capture="environment" />
                <Button type="button" onClick={analizar} disabled={cargando}>
                  Analizar con IA
                </Button>
              </div>
            )}
            {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

            {token && (
              <>
                {fotoUrl && <img src={fotoUrl} alt="preview" className="w-full max-h-56 object-cover rounded-lg" />}
                <form onSubmit={confirmar} className="flex flex-col gap-3">
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
                  <div className="flex gap-2">
                    <Button type="submit" disabled={cargando}>
                      Guardar
                    </Button>
                    <Button type="button" variant="outline" onClick={cerrarForm}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </>
            )}
            {!token && (
              <Button type="button" variant="outline" size="sm" onClick={cerrarForm} className="w-fit">
                Cancelar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {prendas.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay prendas registradas.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {prendas.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <img src={`/${p.foto_path}`} alt={p.tipo} className="w-full h-28 object-cover" />
              <CardContent className="p-2 text-sm">
                <strong>{p.tipo}</strong>
                <br />
                {p.color} · {p.formalidad}
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
  );
}
