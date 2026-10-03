const MENSAJES_CONOCIDOS: { patron: RegExp; mensaje: string }[] = [
  {
    patron: /no queda ninguna prenda disponible para sustituir/i,
    mensaje: "No tienes otra prenda de ese tipo para cambiar. Agrega más ropa a tu armario para tener opciones.",
  },
  {
    patron: /no hay prendas disponibles/i,
    mensaje: "Tu armario está vacío. Sube al menos una prenda antes de pedir combinaciones.",
  },
  {
    patron: /no se pudo armar ningún conjunto/i,
    mensaje: "No encontré una combinación con lo que tienes disponible ahora mismo.",
  },
];

export function mensajeAmigable(error: string): string {
  for (const { patron, mensaje } of MENSAJES_CONOCIDOS) {
    if (patron.test(error)) return mensaje;
  }
  return "Algo no funcionó. Inténtalo de nuevo en un momento.";
}
