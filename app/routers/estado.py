from __future__ import annotations

from fastapi import APIRouter

from app.db import db_session
from app.services import estado_led

router = APIRouter(tags=["estado"])


@router.get("/eventos")
def listar_eventos(desde: str | None = None, tipo: str | None = None, limite: int = 200):
    query = "SELECT * FROM evento_log WHERE 1=1"
    params = []
    if desde:
        query += " AND timestamp >= ?"
        params.append(desde)
    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limite)

    with db_session() as conn:
        filas = conn.execute(query, params).fetchall()
    return [dict(f) for f in filas]


@router.get("/estado")
def estado_global():
    with db_session() as conn:
        prendas = [dict(f) for f in conn.execute("SELECT * FROM prenda").fetchall()]
        zonas = [dict(f) for f in conn.execute("SELECT * FROM zona").fetchall()]
        sesion_activa = conn.execute(
            "SELECT * FROM sesion_recomendacion WHERE estado = 'en_curso' ORDER BY creado_en DESC LIMIT 1"
        ).fetchone()

    return {
        "prendas": prendas,
        "zonas": zonas,
        "sesion_activa": dict(sesion_activa) if sesion_activa else None,
        "leds": estado_led.obtener_estado(),
    }
