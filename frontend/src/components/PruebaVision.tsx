import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api, type Prenda } from "@/lib/api";

const REFRESCO_MS = 2000;

export function PruebaVision() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [cambiadas, setCambiadas] = useState<Set<number>>(new Set());
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null,
  );
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const ps = await api.listarPrendas();
      setPrendas((anteriores) => {
        const antes = new Map(anteriores.map((p) => [p.id, p.estado]));
        const dif = ps.filter(
          (p) => antes.has(p.id) && antes.get(p.id) !== p.estado,
        );
        if (dif.length) {
          setCambiadas(new Set(dif.map((p) => p.id)));
          setTimeout(() => setCambiadas(new Set()), 4000);
        }
        return ps;
      });
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

  const ordenadas = [...prendas].sort(
    (a, b) =>
      Number(a.estado === "fuera") - Number(b.estado === "fuera") ||
      a.id - b.id,
  );
  const disponibles = prendas.filter((p) => p.estado === "disponible").length;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prueba de visión</h1>
          <p className="text-sm text-muted-foreground">
            Saca la foto del closet desde el celular en{" "}
            <strong>/escaner</strong>; acá aparece qué prendas están
            disponibles.
          </p>
        </div>
        <Badge variant="pink">
          {disponibles} de {prendas.length} disponibles
        </Badge>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-6 gap-3">
        {ordenadas.map((p) => {
          const fuera = p.estado === "fuera";
          return (
            <Card
              key={p.id}
              className={
                cambiadas.has(p.id) ? "border-2 border-[var(--v-pink)]" : ""
              }
            >
              <CardContent
                className={`p-2 flex flex-col gap-1 ${fuera ? "opacity-40" : ""}`}
              >
                <img
                  src={p.foto_path}
                  alt={p.tipo}
                  className="w-full h-28 object-cover rounded-md"
                />
                <strong className="text-sm">
                  #{p.id} {p.tipo}
                </strong>
                <span className="text-xs text-muted-foreground">{p.color}</span>
                <span className="text-xs">
                  {fuera ? "🚪 fuera del closet" : "✅ disponible"}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Se actualiza cada {REFRESCO_MS / 1000}s
        {ultimaActualizacion
          ? ` · última: ${ultimaActualizacion.toLocaleTimeString()}`
          : ""}
      </p>
    </div>
  );
}
