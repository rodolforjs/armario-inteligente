import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type EstadoGlobal, type Prenda } from "@/lib/api";

export function PanelEstado({ onCambio }: { onCambio?: () => void }) {
  const [estado, setEstado] = useState<EstadoGlobal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [prendaSim, setPrendaSim] = useState("");
  const [zonaSim, setZonaSim] = useState("");
  const [mensajeSim, setMensajeSim] = useState("");

  function cargar() {
    setCargando(true);
    api
      .obtenerEstado()
      .then(setEstado)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  const prendasConTag = (estado?.prendas ?? []).filter((p: Prenda) => p.tag_uid);
  const zonasEncendidasIds = new Set((estado?.leds.zonas_encendidas ?? []).map((z) => z.zona_id));

  async function simular(tipo: "visto" | "perdido") {
    const prenda = prendasConTag.find((p) => String(p.id) === prendaSim);
    if (!prenda || !prenda.tag_uid) {
      setMensajeSim("Elige una prenda con tag NFC asignado.");
      return;
    }
    if (tipo === "visto" && !zonaSim) {
      setMensajeSim("Elige en qué zona se vio la prenda.");
      return;
    }
    try {
      await api.simularEventoNfc(prenda.tag_uid, zonaSim, tipo);
      setMensajeSim(`Simulado: ${prenda.tipo} -> ${tipo}${tipo === "visto" ? ` en ${zonaSim}` : ""}.`);
      cargar();
      onCambio?.();
    } catch (err) {
      setMensajeSim((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-muted-foreground">Estado del sistema (NFC + LEDs)</h2>
        <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando}>
          Refrescar
        </Button>
      </div>

      {/* ---------- Zonas y LEDs ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {estado?.zonas.map((z) => {
          const prendaAqui = estado.prendas.find((p) => p.zona_actual === z.id && p.estado === "disponible");
          const encendida = zonasEncendidasIds.has(z.id);
          return (
            <Card key={z.id} className={encendida ? "border-2 border-[var(--v-pink)]" : ""}>
              <CardContent className="p-2 text-xs flex flex-col gap-1">
                <strong>{z.nombre}</strong>
                <span className="text-muted-foreground">
                  {z.tipo} · led {z.led_id ?? "—"}
                </span>
                {encendida && <Badge variant="pink">💡 encendida</Badge>}
                {prendaAqui ? <span className="truncate">👕 {prendaAqui.tipo}</span> : <span className="text-muted-foreground">vacía</span>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {estado?.leds.motivo && <p className="text-xs text-muted-foreground">Motivo LED actual: {estado.leds.motivo}</p>}

      {/* ---------- Simulador NFC (para probar sin hardware) ---------- */}
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          <p className="text-xs text-muted-foreground">
            Simulador de lector NFC — útil para probar la conexión completa mientras no tengas el ESP32 conectado.
          </p>
          <Select value={prendaSim} onValueChange={setPrendaSim}>
            <SelectTrigger>
              <SelectValue placeholder="Elige una prenda con tag NFC" />
            </SelectTrigger>
            <SelectContent>
              {prendasConTag.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.tipo} ({p.tag_uid})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zonaSim} onValueChange={setZonaSim}>
            <SelectTrigger>
              <SelectValue placeholder="Zona donde se detectó" />
            </SelectTrigger>
            <SelectContent>
              {estado?.zonas.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => simular("visto")} className="flex-1">
              Simular "visto"
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => simular("perdido")} className="flex-1">
              Simular "perdido"
            </Button>
          </div>
          {mensajeSim && <p className="text-xs text-muted-foreground">{mensajeSim}</p>}
          {prendasConTag.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ninguna prenda tiene tag NFC asignado todavía (se asigna al editarla desde su vista de detalle).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
