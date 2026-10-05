export type Atributos = {
  tipo: string;
  color: string;
  formalidad: string;
  abrigo: string;
};

export type Prenda = {
  id: number;
  foto_path: string;
  tipo: string;
  color: string;
  formalidad: string;
  abrigo: string;
  tag_uid: string | null;
  zona_actual: string | null;
  marca: string | null;
  material: string | null;
  temporada: string | null;
  estado: "disponible" | "fuera";
  veces_usada: number;
  fecha_ultimo_uso: string | null;
  creado_en: string;
};

export type Zona = { id: string; nombre: string; led_id: string | null; tipo: "colgador" | "cajon" };

export type LedZonaEncendida = { zona_id: string; led_id: string | null; tipo: string };

export type EstadoGlobal = {
  prendas: Prenda[];
  zonas: Zona[];
  sesion_activa: unknown;
  leds: { zonas_encendidas: LedZonaEncendida[]; motivo: string };
};

export type PiezaConjunto = {
  id: number;
  tipo: string;
  color: string;
  formalidad: string;
  abrigo: string;
  foto_path: string;
};

export type Conjunto = {
  prenda_ids: number[];
  piezas: PiezaConjunto[];
  score: number;
  razon: string;
};

export type Clima = {
  temperatura_c: number;
  precipitacion_mm: number;
  viento_kmh: number;
  categoria: string;
};

export type Modo = "exploratorio" | "pocas_opciones" | "preciso";

export type AccionVoz =
  | "abrir_camara"
  | "capturar_foto"
  | "usar_foto"
  | "repetir_foto"
  | "cancelar"
  | "guardar_prenda"
  | "ver_combinaciones"
  | "confirmar_conjunto"
  | "cambiar_prenda"
  | "otras_opciones"
  | "preguntar"
  | "desconocido";

export type RespuestaVoz = {
  accion: AccionVoz;
  parametro?: string;
  ocasion?: "casual" | "formal" | "deportivo" | null;
  respuesta_hablada: string;
};

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  subirFoto: (archivo: File) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return fetch("/prendas/foto", { method: "POST", body: formData }).then(parseOrThrow) as Promise<{
      token: string;
      atributos: Atributos;
      ia_disponible: boolean;
      foto_url: string;
    }>;
  },

  confirmarPrenda: (payload: {
    token: string;
    tipo: string;
    color: string;
    formalidad: string;
    abrigo: string;
    zona_actual?: string;
    tag_uid?: string;
    marca?: string;
    material?: string;
    temporada?: string;
  }) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([k, v]) => v && formData.append(k, v));
    return fetch("/prendas", { method: "POST", body: formData }).then(parseOrThrow) as Promise<{
      id: number;
      foto_path: string;
    }>;
  },

  listarPrendas: () => fetch("/prendas").then(parseOrThrow) as Promise<Prenda[]>,

  editarPrenda: (id: number, cambios: Partial<Prenda>) =>
    fetch(`/prendas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    }).then(parseOrThrow),

  listarZonas: () => fetch("/zonas").then(parseOrThrow) as Promise<Zona[]>,

  obtenerEstado: () => fetch("/estado").then(parseOrThrow) as Promise<EstadoGlobal>,

  simularEventoNfc: (uid: string, zona: string, tipo: "visto" | "perdido") =>
    fetch("/eventos/nfc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, zona, tipo }),
    }).then(parseOrThrow),

  pedirRecomendacion: (payload: { modo: Modo; ocasion: string | null; texto_libre: string | null }) =>
    fetch("/recomendaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseOrThrow) as Promise<{ sesion_id: string; clima: Clima; conjuntos: Conjunto[] }>,

  obtenerSesion: (sesionId: string) =>
    fetch(`/recomendaciones/${sesionId}`).then(parseOrThrow) as Promise<{
      conjuntos: Conjunto[];
    }>,

  aceptarConjunto: (sesionId: string, prendaIds: number[]) =>
    fetch(`/recomendaciones/${sesionId}/aceptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prenda_ids: prendaIds }),
    }).then(parseOrThrow),

  rechazarPrenda: (sesionId: string, conjuntoIdx: number, prendaId: number) =>
    fetch(`/recomendaciones/${sesionId}/rechazar-prenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conjunto_idx: conjuntoIdx, prenda_id: prendaId }),
    }).then(parseOrThrow) as Promise<{ conjuntos: Conjunto[] }>,

  rechazarConjunto: (sesionId: string) =>
    fetch(`/recomendaciones/${sesionId}/rechazar-conjunto`, { method: "POST" }).then(parseOrThrow) as Promise<{
      estado: string;
      clima?: Clima;
      conjuntos?: Conjunto[];
    }>,

  comandoVoz: (texto: string, contexto: Record<string, unknown>) =>
    fetch("/asistente/comando", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, contexto }),
    }).then(parseOrThrow) as Promise<RespuestaVoz>,
};
