from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import db_session

router = APIRouter(prefix="/zonas", tags=["zonas"])


class ZonaIn(BaseModel):
    id: str
    nombre: str
    led_id: str | None = None
    tipo: str = "colgador"  # "colgador" | "cajon"


class GenerarColgadorIn(BaseModel):
    cantidad: int
    prefijo: str = "percha"
    nombre_base: str = "Percha"


@router.get("")
def listar_zonas():
    with db_session() as conn:
        filas = conn.execute("SELECT * FROM zona ORDER BY id").fetchall()
    return [dict(f) for f in filas]


@router.post("")
def crear_zona(zona: ZonaIn):
    if zona.tipo not in ("colgador", "cajon"):
        raise HTTPException(400, "tipo debe ser 'colgador' o 'cajon'")
    with db_session() as conn:
        existente = conn.execute("SELECT id FROM zona WHERE id = ?", (zona.id,)).fetchone()
        if existente is not None:
            raise HTTPException(409, f"Ya existe una zona con id '{zona.id}'")
        conn.execute(
            "INSERT INTO zona (id, nombre, led_id, tipo) VALUES (?, ?, ?, ?)",
            (zona.id, zona.nombre, zona.led_id, zona.tipo),
        )
    return zona


@router.post("/generar-colgador")
def generar_zonas_colgador(datos: GenerarColgadorIn):
    """Crea N zonas tipo 'colgador', una por posición del tubo LED direccionable
    (led_id = índice 0..N-1, para mandarle directo al ESP32 qué píxel prender)."""
    if datos.cantidad < 1 or datos.cantidad > 200:
        raise HTTPException(400, "cantidad debe estar entre 1 y 200")

    creadas = []
    with db_session() as conn:
        existentes = {
            f["id"] for f in conn.execute("SELECT id FROM zona WHERE id LIKE ?", (f"{datos.prefijo}_%",)).fetchall()
        }
        for i in range(datos.cantidad):
            zona_id = f"{datos.prefijo}_{i}"
            if zona_id in existentes:
                continue
            nombre = f"{datos.nombre_base} {i}"
            conn.execute(
                "INSERT INTO zona (id, nombre, led_id, tipo) VALUES (?, ?, ?, 'colgador')",
                (zona_id, nombre, str(i)),
            )
            creadas.append({"id": zona_id, "nombre": nombre, "led_id": str(i), "tipo": "colgador"})
    return {"creadas": creadas, "total_creadas": len(creadas)}


@router.delete("/{zona_id}")
def borrar_zona(zona_id: str):
    with db_session() as conn:
        fila = conn.execute("SELECT id FROM zona WHERE id = ?", (zona_id,)).fetchone()
        if fila is None:
            raise HTTPException(404, "Zona no encontrada")
        conn.execute("UPDATE prenda SET zona_actual = NULL WHERE zona_actual = ?", (zona_id,))
        conn.execute("DELETE FROM zona WHERE id = ?", (zona_id,))
    return {"ok": True}
