import { useState } from "react";

export function usePersistido<T>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(clave);
      return guardado === null ? inicial : (JSON.parse(guardado) as T);
    } catch {
      return inicial;
    }
  });

  function cambiar(nuevo: T | ((previo: T) => T)) {
    setValor((previo) => {
      const siguiente = typeof nuevo === "function" ? (nuevo as (p: T) => T)(previo) : nuevo;
      try {
        localStorage.setItem(clave, JSON.stringify(siguiente));
      } catch {
        // sin almacenamiento: el valor solo vive en memoria
      }
      return siguiente;
    });
  }

  return [valor, cambiar] as const;
}
