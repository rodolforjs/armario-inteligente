import { useRef, useState } from "react";
import { api, type Clima, type Conjunto, type Modo, type Preferencias } from "@/lib/api";
import { mensajeAmigable } from "@/lib/errores";

const DURACION_AVISO_MS = 6000;

export function useCombinaciones() {
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [clima, setClima] = useState<Clima | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [confirmado, setConfirmado] = useState<Conjunto | null>(null);
  const pedidoActual = useRef<{ ocasion: string | null; preferencias: Preferencias | null }>({
    ocasion: null,
    preferencias: null,
  });
  const timeoutAviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrarAviso(texto: string, autoLimpiar = true) {
    if (timeoutAviso.current) clearTimeout(timeoutAviso.current);
    setAviso(texto);
    if (autoLimpiar) {
      timeoutAviso.current = setTimeout(() => setAviso(""), DURACION_AVISO_MS);
    }
  }

  async function verCombinaciones(
    modo: Modo = "exploratorio",
    ocasion: string | null = null,
    textoLibre: string | null = null,
    preferencias: Preferencias | null = null,
  ) {
    setBuscando(true);
    setAviso("");
    setConjuntos([]);
    pedidoActual.current = { ocasion, preferencias };
    try {
      const data = await api.pedirRecomendacion({ modo, ocasion, texto_libre: textoLibre, preferencias });
      setSesionId(data.sesion_id);
      setClima(data.clima);
      setConjuntos(data.conjuntos);
      return data.conjuntos;
    } catch (err) {
      mostrarAviso(mensajeAmigable((err as Error).message));
      return [];
    } finally {
      setBuscando(false);
    }
  }

  async function aceptar(idx: number, alConfirmar?: () => void) {
    if (!sesionId) return;
    setBuscando(true);
    try {
      const sesion = await api.obtenerSesion(sesionId);
      const conjuntoConfirmado = sesion.conjuntos[idx];
      await api.aceptarConjunto(sesionId, conjuntoConfirmado.prenda_ids);
      setConfirmado(conjuntoConfirmado);
      setConjuntos([]);
      setSesionId(null);
      alConfirmar?.();
    } catch (err) {
      mostrarAviso(mensajeAmigable((err as Error).message));
    } finally {
      setBuscando(false);
    }
  }

  function cerrarConfirmacion() {
    setConfirmado(null);
  }

  async function cambiarPrenda(idx: number, prendaId: number) {
    if (!sesionId) return;
    setBuscando(true);
    try {
      const data = await api.rechazarPrenda(sesionId, idx, prendaId);
      setConjuntos(data.conjuntos);
    } catch (err) {
      mostrarAviso(mensajeAmigable((err as Error).message));
    } finally {
      setBuscando(false);
    }
  }

  // Con un índice rechaza solo esa opción y deja las demás; sin índice descarta todas las que se muestran.
  async function otrasOpciones(idx?: number) {
    if (!sesionId) return;
    setBuscando(true);
    try {
      const data = await api.rechazarConjunto(sesionId, typeof idx === "number" ? idx : undefined);
      if (data.estado === "modo_libre") {
        mostrarAviso("Ya no me quedan combinaciones nuevas con lo que hay disponible. Elige tú desde tu armario esta vez.", false);
        setConjuntos([]);
        setSesionId(null);
        return;
      }
      if (data.clima) setClima(data.clima);
      setConjuntos(data.conjuntos ?? []);
    } catch (err) {
      mostrarAviso(mensajeAmigable((err as Error).message));
    } finally {
      setBuscando(false);
    }
  }

  function reiniciar() {
    setSesionId(null);
    setConjuntos([]);
    setClima(null);
    setAviso("");
  }

  return {
    sesionId,
    pedidoActual,
    conjuntos,
    clima,
    buscando,
    aviso,
    confirmado,
    verCombinaciones,
    aceptar,
    cambiarPrenda,
    otrasOpciones,
    reiniciar,
    cerrarConfirmacion,
  };
}
