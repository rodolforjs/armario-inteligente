import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type Prenda } from "@/lib/api";

export function Inventario() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [cargando, setCargando] = useState(false);

  function cargar() {
    setCargando(true);
    api
      .listarPrendas()
      .then(setPrendas)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={cargar} disabled={cargando} className="w-fit">
        Refrescar
      </Button>

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
