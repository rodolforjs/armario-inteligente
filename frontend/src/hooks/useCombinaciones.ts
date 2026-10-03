import { useState } from "react";
import { api, type Clima, type Conjunto, type Modo } from "@/lib/api";

export function useCombinaciones() {
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [clima, setClima] = useState<Clima | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [confirmado, setConfirmado] = useState<Conjunto | null>(null);

  async function verCombinaciones(modo: Modo = "exploratorio") {
    setBuscando(true);
    setAviso("");
    setConjuntos([]);
    try {
      const data = await api.pedirRecomendacion({ modo, ocasion: null, texto_libre: null });
      setSesionId(data.sesion_id);
      setClima(data.clima);
      setConjuntos(data.conjuntos);
      return data.conjuntos;
    } catch (err) {
      setAviso(`Error: ${(err as Error).message}`);
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
      setAviso(`Error: ${(err as Error).message}`);
    } finally {
      setBuscando(false);
    }
  }

  async function otrasOpciones() {
    if (!sesionId) return;
    setBuscando(true);
    try {
      const data = await api.rechazarConjunto(sesionId);
      if (data.estado === "modo_libre") {
        setAviso("Ya van 2 rechazos. Elige tú mismo desde tu armario esta vez.");
        setConjuntos([]);
        setSesionId(null);
        return;
      }
      setClima(data.clima ?? null);
      setConjuntos(data.conjuntos ?? []);
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
