from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.db import db_session
from app.services import vision_perchero
from app.services.eventos import registrar_evento

router = APIRouter(prefix="/vision", tags=["vision"])

UMBRAL_CONFIANZA = 0.6
MAX_CANDIDATAS = 15


def _zonas_colgador_ordenadas(conn) -> list[dict]:
    filas = conn.execute(
        """SELECT * FROM zona WHERE tipo = 'colgador'
           ORDER BY (CASE WHEN led_id ~ '^[0-9]+$' THEN led_id::int ELSE 999999 END)"""
    ).fetchall()
    return [dict(f) for f in filas]


def _zona_para_posicion(zonas: list[dict], posicion_relativa: float, camara_id: str) -> str | None:
    if not zonas:
        return None
    n = len(zonas)
    mitad = n / 2
    if camara_id == "izquierda":
        indice = round(posicion_relativa * max(mitad - 1, 0))
    elif camara_id == "derecha":
        indice = round(mitad + posicion_relativa * max(n - mitad - 1, 0))
    else:
        indice = round(posicion_relativa * (n - 1))
    indice = max(0, min(n - 1, int(indice)))
    return zonas[indice]["id"]


@router.post("/escanear-perchero")
async def escanear_perchero(
    archivo: UploadFile = File(...),
    camara_id: str = Form("unica"),  # "izquierda" | "derecha" | "unica"
):
    if archivo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato de imagen no soportado (usa jpg, png o webp)")

    contenido = await archivo.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(400, "La imagen es muy pesada (máx 8MB)")

    with db_session() as conn:
        candidatas = conn.execute(
            "SELECT id, tipo, color, foto_path FROM prenda WHERE estado = 'fuera' OR zona_actual IS NULL ORDER BY id LIMIT ?",
            (MAX_CANDIDATAS,),
        ).fetchall()
        candidatas = [dict(c) for c in candidatas]
        zonas = _zonas_colgador_ordenadas(conn)

    if not candidatas:
        return {"confirmadas": [], "pendientes": [], "mensaje": "No hay prendas pendientes de ubicar."}

    try:
        coincidencias = vision_perchero.reconocer_perchero(contenido, archivo.content_type, candidatas)
    except Exception as exc:
        raise HTTPException(502, f"No se pudo analizar la foto del perchero: {exc}") from exc

    candidatas_por_id = {c["id"]: c for c in candidatas}
    confirmadas = []
    pendientes = []
    ahora = datetime.now(timezone.utc).isoformat()

    with db_session() as conn:
        for c in coincidencias:
            prenda = candidatas_por_id.get(c["prenda_id"])
            if prenda is None:
                continue
            zona_id = _zona_para_posicion(zonas, c["posicion_relativa"], camara_id)
            item = {
                "prenda_id": prenda["id"],
                "tipo": prenda["tipo"],
                "foto_path": prenda["foto_path"],
                "zona_sugerida": zona_id,
                "confianza": c["confianza"],
            }
            if c["confianza"] >= UMBRAL_CONFIANZA and zona_id:
                conn.execute(
                    "UPDATE prenda SET estado = 'disponible', zona_actual = ? WHERE id = ?",
                    (zona_id, prenda["id"]),
                )
                registrar_evento(
                    conn,
                    "vision_perchero_detectada",
                    prenda_id=prenda["id"],
                    payload={"camara_id": camara_id, "zona": zona_id, "confianza": c["confianza"]},
                )
                confirmadas.append(item)
            else:
                pendientes.append(item)

    return {"confirmadas": confirmadas, "pendientes": pendientes}


class ConfirmarDeteccion(BaseModel):
    prenda_id: int
    zona_id: str | None = None  # None = el usuario dice que esa detección estaba mal, no se aplica


@router.post("/confirmar")
def confirmar_deteccion(datos: ConfirmarDeteccion):
    with db_session() as conn:
        prenda = conn.execute("SELECT id FROM prenda WHERE id = ?", (datos.prenda_id,)).fetchone()
        if prenda is None:
            raise HTTPException(404, "Prenda no encontrada")
        if datos.zona_id:
            conn.execute(
                "UPDATE prenda SET estado = 'disponible', zona_actual = ? WHERE id = ?",
                (datos.zona_id, datos.prenda_id),
            )
            registrar_evento(conn, "vision_perchero_confirmada", prenda_id=datos.prenda_id, payload={"zona": datos.zona_id})
        else:
            registrar_evento(conn, "vision_perchero_rechazada", prenda_id=datos.prenda_id)
    return {"ok": True}
