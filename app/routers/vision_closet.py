from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.db import db_session
from app.services import vision_closet
from app.services.eventos import registrar_evento

router = APIRouter(prefix="/vision", tags=["vision"])

UMBRAL_CONFIANZA = 0.6
MAX_CANDIDATAS = 30

# Solo las prendas que cuelgan las ve la cámara del closet. Short, pantalones, zapatos y accesorios
# no se escanean: su estado nunca lo cambia el escaneo.
TIPOS_COLGADOS = (
    "poler", "camis", "chaquet", "abrig", "chalec", "suéter", "sueter",
    "sudader", "parka", "blus", "vestid", "cardigan", "jersey",
)


def _cuelga(tipo: str) -> bool:
    t = (tipo or "").lower()
    return any(k in t for k in TIPOS_COLGADOS)


@router.post("/escanear-closet")
async def escanear_closet(archivo: UploadFile = File(...)):
    """La cámara del closet manda una foto: las prendas reconocidas quedan 'disponible' (están en el
    closet), las que no aparecen quedan 'fuera'. Las dudosas (confianza baja) esperan confirmación."""
    if archivo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato de imagen no soportado (usa jpg, png o webp)")

    contenido = await archivo.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(400, "La imagen es muy pesada (máx 8MB)")

    with db_session() as conn:
        todas = [dict(c) for c in conn.execute("SELECT id, tipo, color, foto_path FROM prenda ORDER BY id").fetchall()]
    prendas = [p for p in todas if _cuelga(p["tipo"])][:MAX_CANDIDATAS]

    if not prendas:
        return {"disponibles": [], "fuera": [], "dudosas": [], "mensaje": "Todavía no hay prendas colgables guardadas (polerones, camisas, poleras, chaquetas)."}

    try:
        coincidencias = vision_closet.reconocer_closet(contenido, archivo.content_type, prendas)
    except Exception as exc:
        raise HTTPException(502, f"No se pudo analizar la foto del closet: {exc}") from exc

    # Si la IA repite una prenda, nos quedamos con la lectura más segura.
    mejor: dict[int, float] = {}
    for c in coincidencias:
        mejor[c["prenda_id"]] = max(c["confianza"], mejor.get(c["prenda_id"], 0.0))

    disponibles, dudosas, fuera = [], [], []
    with db_session() as conn:
        for p in prendas:
            confianza = mejor.get(p["id"])
            item = {"prenda_id": p["id"], "tipo": p["tipo"], "color": p["color"], "foto_path": p["foto_path"]}
            if confianza is None:
                conn.execute("UPDATE prenda SET estado = 'fuera' WHERE id = ?", (p["id"],))
                fuera.append(item)
            elif confianza >= UMBRAL_CONFIANZA:
                conn.execute("UPDATE prenda SET estado = 'disponible' WHERE id = ?", (p["id"],))
                disponibles.append({**item, "confianza": confianza})
            else:
                dudosas.append({**item, "confianza": confianza})
        registrar_evento(
            conn,
            "closet_escaneado",
            payload={"disponibles": [i["prenda_id"] for i in disponibles], "fuera": [i["prenda_id"] for i in fuera]},
        )

    return {"disponibles": disponibles, "fuera": fuera, "dudosas": dudosas}


class ConfirmarDeteccion(BaseModel):
    prenda_id: int
    esta: bool  # True = sí está en el closet, False = el usuario dice que la detección estaba mal


@router.post("/confirmar")
def confirmar_deteccion(datos: ConfirmarDeteccion):
    with db_session() as conn:
        prenda = conn.execute("SELECT id FROM prenda WHERE id = ?", (datos.prenda_id,)).fetchone()
        if prenda is None:
            raise HTTPException(404, "Prenda no encontrada")
        conn.execute(
            "UPDATE prenda SET estado = ? WHERE id = ?",
            ("disponible" if datos.esta else "fuera", datos.prenda_id),
        )
        registrar_evento(
            conn,
            "closet_deteccion_confirmada" if datos.esta else "closet_deteccion_rechazada",
            prenda_id=datos.prenda_id,
        )
    return {"ok": True}
