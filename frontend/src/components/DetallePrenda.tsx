import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Prenda } from "@/lib/api";

export function DetallePrenda({
  prenda,
  onCerrar,
  onGuardado,
}: {
  prenda: Prenda;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [valores, setValores] = useState({
    tipo: prenda.tipo,
    color: prenda.color,
    formalidad: prenda.formalidad,
    abrigo: prenda.abrigo,
    marca: prenda.marca ?? "",
    material: prenda.material ?? "",
    temporada: prenda.temporada ?? "",
    estado: prenda.estado,
  });

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await api.editarPrenda(prenda.id, {
        ...valores,
      });
      onGuardado();
      setEditando(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40" onClick={onCerrar}>
      <Card className="max-w-sm w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <img src={prenda.foto_path} alt={prenda.tipo} className="w-full h-56 object-cover" />
        <CardContent className="flex flex-col gap-3 pt-4">
          {!editando ? (
            <>
              <h2 className="text-lg font-semibold capitalize">{prenda.tipo}</h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={prenda.estado === "disponible" ? "olive" : "yellow"}>{prenda.estado}</Badge>
                <Badge variant="cream">{prenda.formalidad}</Badge>
                <Badge variant="blue-soft">{prenda.abrigo}</Badge>
              </div>
              <dl className="text-sm flex flex-col gap-1">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Color</dt>
                  <dd>{prenda.color}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Marca</dt>
                  <dd>{prenda.marca || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Material</dt>
                  <dd>{prenda.material || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Temporada</dt>
                  <dd>{prenda.temporada || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Veces usada</dt>
                  <dd>{prenda.veces_usada}</dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <Button type="button" onClick={() => setEditando(true)} className="flex-1">
                  Editar
                </Button>
                <Button type="button" variant="outline" onClick={onCerrar}>
                  Cerrar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Input value={valores.tipo} onChange={(e) => setValores({ ...valores, tipo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <Input value={valores.color} onChange={(e) => setValores({ ...valores, color: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Formalidad</Label>
                <Select value={valores.formalidad} onValueChange={(v) => setValores({ ...valores, formalidad: v })}>
                  <SelectTrigger className="w-full">
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
                <Select value={valores.abrigo} onValueChange={(v) => setValores({ ...valores, abrigo: v })}>
                  <SelectTrigger className="w-full">
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
                <Label>Marca</Label>
                <Input
                  value={valores.marca}
                  onChange={(e) => setValores({ ...valores, marca: e.target.value })}
                  placeholder="ej. Nike, sin marca, etc."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Material</Label>
                <Input
                  value={valores.material}
                  onChange={(e) => setValores({ ...valores, material: e.target.value })}
                  placeholder="ej. algodón, denim, lana"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Temporada</Label>
                <Select value={valores.temporada || "ninguna"} onValueChange={(v) => setValores({ ...valores, temporada: v === "ninguna" ? "" : v })}>
                  <SelectTrigger className="w-full">
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
              <div className="flex flex-col gap-1.5">
                <Label>Estado</Label>
                <Select value={valores.estado} onValueChange={(v) => setValores({ ...valores, estado: v as Prenda["estado"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">disponible</SelectItem>
                    <SelectItem value="fuera">fuera</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="button" onClick={guardar} disabled={guardando} className="flex-1">
                  Guardar cambios
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
