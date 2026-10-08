import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type Prenda, type Zona } from "@/lib/api";

const REFRESCO_MS = 2000;

export function PruebaVision() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [nuevas, setNuevas] = useState<Set<number>>(new Set());
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [ps, zs] = await Promise.all([api.listarPrendas(), api.listarZonas()]);
      setPrendas((anteriores) => {
        const antes = new Map(anteriores.map((p) => [p.id, p.zona_actual]));
        const cambiadas = ps.filter((p) => p.zona_actual && antes.has(p.id) && antes.get(p.id) !== p.zona_actual);
        if (cambiadas.length) {
          setNuevas(new Set(cambiadas.map((p) => p.id)));
          setTimeout(() => setNuevas(new Set()), 4000);
        }
        return ps;
      });
      setZonas(zs);
      setUltimaActualizacion(new Date());
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [cargar]);

  async function vaciar() {
    await Promise.all(prendas.filter((p) => p.zona_actual).map((p) => api.editarPrenda(p.id, { zona_actual: null })));
    cargar();
  }

  const perchas = zonas.filter((z) => z.tipo === "colgador");
  const ubicadas = prendas.filter((p) => p.zona_actual).length;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prueba de visión</h1>
          <p className="text-sm text-muted-foreground">
            Saca la foto desde el celular en <strong>/escaner</strong>; acá aparece lo que el sistema detectó.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="pink">
            {ubicadas} de {prendas.length} ubicadas
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={vaciar} disabled={ubicadas === 0}>
            Vaciar perchero
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-5 gap-3">
        {perchas.map((z) => {
          const prenda = prendas.find((p) => p.zona_actual === z.id);
          return (
            <Card key={z.id} className={prenda && nuevas.has(prenda.id) ? "border-2 border-[var(--v-pink)]" : ""}>
              <CardContent className="p-2 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{z.nombre}</span>
                {prenda ? (
                  <>
                    <img src={prenda.foto_path} alt={prenda.tipo} className="w-full h-32 object-cover rounded-md" />
                    <strong className="text-sm">
                      #{prenda.id} {prenda.tipo}
                    </strong>
                    <span className="text-xs text-muted-foreground">{prenda.color}</span>
                  </>
                ) : (
                  <div className="h-32 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                    vacía
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Se actualiza cada {REFRESCO_MS / 1000}s{ultimaActualizacion ? ` · última: ${ultimaActualizacion.toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}
