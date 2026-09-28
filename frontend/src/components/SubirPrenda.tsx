import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Atributos, type Zona } from "@/lib/api";

export function SubirPrenda() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atributos, setAtributos] = useState<Atributos>({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
  const [zonaActual, setZonaActual] = useState<string>("");
  const [tagUid, setTagUid] = useState("");

  useEffect(() => {
    api.listarZonas().then(setZonas).catch(() => {});
  }, []);

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
      await api.confirmarPrenda({
        token,
        ...atributos,
        zona_actual: zonaActual || undefined,
        tag_uid: tagUid || undefined,
      });
      setMensaje("Prenda guardada en el inventario.");
      setToken(null);
      setFotoUrl(null);
      setAtributos({ tipo: "", color: "", formalidad: "casual", abrigo: "medio" });
      setZonaActual("");
      setTagUid("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input ref={fileInputRef} type="file" accept="image/*" capture="environment" />
        <Button type="button" onClick={analizar} disabled={cargando}>
          Analizar con IA
        </Button>
      </div>
      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {token && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmar prenda</CardTitle>
          </CardHeader>
          <CardContent>
            {fotoUrl && (
              <img src={fotoUrl} alt="preview" className="w-full max-h-64 object-cover rounded-lg mb-4" />
            )}
            <form onSubmit={confirmar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <Input
                  id="tipo"
                  required
                  value={atributos.tipo}
                  onChange={(e) => setAtributos({ ...atributos, tipo: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  required
                  value={atributos.color}
                  onChange={(e) => setAtributos({ ...atributos, color: e.target.value })}
                />
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
                <Label htmlFor="tag">Tag NFC (opcional)</Label>
                <Input id="tag" value={tagUid} onChange={(e) => setTagUid(e.target.value)} />
              </div>
              <Button type="submit" disabled={cargando}>
                Confirmar y guardar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
