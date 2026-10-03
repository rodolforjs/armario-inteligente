import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Conjunto } from "@/lib/api";

export function PantallaExito({
  conjunto,
  onCerrar,
  oscuro = false,
}: {
  conjunto: Conjunto;
  onCerrar: () => void;
  oscuro?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-5xl">✅</div>
      <h2 className={`text-xl font-semibold ${oscuro ? "text-white drop-shadow" : ""}`}>¡Listo! Tu conjunto quedó confirmado</h2>
      <p className={`text-sm ${oscuro ? "text-white/80 drop-shadow" : "text-muted-foreground"}`}>Que lo disfrutes.</p>

      <div className="flex flex-wrap gap-3 justify-center">
        {conjunto.piezas.map((p) => (
          <Card key={p.id} className={`w-40 overflow-hidden ${oscuro ? "bg-white/90 backdrop-blur" : ""}`}>
            <img src={p.foto_path} alt={p.tipo} className="w-full h-32 object-cover" />
            <CardContent className="p-2 text-xs flex flex-col gap-1">
              <strong className="capitalize">{p.tipo}</strong>
              <span className="text-muted-foreground">{p.color}</span>
              <div className="flex flex-wrap gap-1">
                <Badge variant="cream">{p.formalidad}</Badge>
                <Badge variant="blue-soft">{p.abrigo}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" onClick={onCerrar} className={oscuro ? "bg-white/10 backdrop-blur" : ""} variant={oscuro ? "outline" : "default"}>
        Volver
      </Button>
    </div>
  );
}
