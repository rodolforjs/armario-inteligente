import type { PiezaConjunto } from "@/lib/api";

// Orden natural para vestirse: arriba, abajo, calzado y, al final, accesorios.
function rango(tipo: string): number {
  const t = tipo.toLowerCase();
  if (/zapat|zapatill|bota|sandal|mocas|calzado/.test(t)) return 2;
  if (
    /reloj|collar|pulsera|anillo|arete|gorro|gorra|bufanda|lente|cintur|corbata|bolso|mochila/.test(
      t,
    )
  )
    return 3;
  if (/pantal|short|falda|jean|bermuda/.test(t)) return 1;
  return 0;
}

export function ordenarParaVestir(piezas: PiezaConjunto[]): PiezaConjunto[] {
  return [...piezas].sort((a, b) => rango(a.tipo) - rango(b.tipo));
}

export function instruccion(p: PiezaConjunto, indice: number): string {
  const nombre = `${p.tipo} ${p.color}`;
  return indice === 0
    ? `Empecemos por tu ${nombre}.`
    : `Ahora ponte ${nombre}.`;
}
