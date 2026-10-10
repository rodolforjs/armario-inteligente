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
  marca: string | null;
  material: string | null;
  temporada: string | null;
  estado: "disponible" | "fuera";
  veces_usada: number;
  fecha_ultimo_uso: string | null;
  creado_en: string;
};

export type PiezaConjunto = {
  id: number;
  tipo: string;
  color: string;
  formalidad: string;
  abrigo: string;
  foto_path: string;
  rol?: "base" | "extra";
};

export type Conjunto = {
  prenda_ids: number[];
  piezas: PiezaConjunto[];
  score: number;
  razon: string;
};

export type EventoLog = {
  id: number;
  timestamp: string;
  tipo: string;
  prenda_id: number | null;
};

export type Clima = {
  temperatura_c: number;
  precipitacion_mm: number;
  viento_kmh: number;
  categoria: string;
};

export type Preferencias = {
  evitar_colores: string[];
  preferir_colores: string[];
  abrigo: "mas_abrigado" | "mas_liviano" | null;
};

export type ProductoMercado = {
  id: string;
  marca: "H&M" | "Zara";
  nombre: string;
  tipo: string;
  color: string;
  formalidad: string;
  motivo: string;
  url: string;
  imagen: string;
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
  | "responder"
  | "ver_tienda"
  | "siguiente_paso"
  | "preguntar"
  | "desconocido";

export type PrendaDetectada = {
  prenda_id: number;
  tipo: string;
  color: string;
  foto_path: string;
  confianza?: number;
};

export type RespuestaVoz = {
  accion: AccionVoz;
  parametro?: string;
  ocasion?: "casual" | "formal" | "deportivo" | null;
  preferencias?: Preferencias | null;
  seguir_escuchando?: boolean;
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
    return fetch("/prendas/foto", { method: "POST", body: formData }).then(
      parseOrThrow,
    ) as Promise<{
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
    marca?: string;
    material?: string;
    temporada?: string;
  }) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([k, v]) => v && formData.append(k, v));
    return fetch("/prendas", { method: "POST", body: formData }).then(
      parseOrThrow,
    ) as Promise<{
      id: number;
      foto_path: string;
    }>;
  },

  listarEventos: (limite = 300) =>
    fetch(`/eventos?limite=${limite}`).then(parseOrThrow) as Promise<
      EventoLog[]
    >,
  prendasSimilares: (tipo: string, color: string) =>
    fetch("/prendas/similares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, color }),
    }).then(parseOrThrow) as Promise<Prenda[]>,

  sugerenciasMercado: () =>
    fetch("/mercado/sugerencias").then(parseOrThrow) as Promise<{
      simulacion: boolean;
      sugerencias: ProductoMercado[];
    }>,

  valorarLook: (prendaIds: number[], valor: -1 | 0 | 1) =>
    fetch("/recomendaciones/valorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prenda_ids: prendaIds, valor }),
    }).then(parseOrThrow),

  opinionLook: (foto: Blob, piezas: string[], tono: string, nombre: string) => {
    const formData = new FormData();
    formData.append("archivo", foto, "look.jpg");
    formData.append("piezas", JSON.stringify(piezas));
    formData.append("tono", tono);
    formData.append("nombre", nombre);
    return fetch("/asistente/opinion-look", {
      method: "POST",
      body: formData,
    }).then(parseOrThrow) as Promise<{
      opinion: string;
    }>;
  },

  listarPrendas: () =>
    fetch("/prendas").then(parseOrThrow) as Promise<Prenda[]>,

  editarPrenda: (id: number, cambios: Partial<Prenda>) =>
    fetch(`/prendas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    }).then(parseOrThrow),

  borrarPrenda: (id: number) =>
    fetch(`/prendas/${id}`, { method: "DELETE" }).then(parseOrThrow),

  pedirRecomendacion: (payload: {
    modo: Modo;
    ocasion: string | null;
    texto_libre: string | null;
    preferencias?: Preferencias | null;
  }) =>
    fetch("/recomendaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseOrThrow) as Promise<{
      sesion_id: string;
      clima: Clima;
      conjuntos: Conjunto[];
    }>,

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

  rechazarConjunto: (sesionId: string, conjuntoIdx?: number) =>
    fetch(`/recomendaciones/${sesionId}/rechazar-conjunto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conjunto_idx: conjuntoIdx ?? null }),
    }).then(parseOrThrow) as Promise<{
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

  escanearCloset: (archivo: File) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return fetch("/vision/escanear-closet", {
      method: "POST",
      body: formData,
    }).then(parseOrThrow) as Promise<{
      disponibles: PrendaDetectada[];
      fuera: PrendaDetectada[];
      dudosas: PrendaDetectada[];
      mensaje?: string;
    }>;
  },

  confirmarDeteccion: (prendaId: number, esta: boolean) =>
    fetch("/vision/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prenda_id: prendaId, esta }),
    }).then(parseOrThrow),
};
