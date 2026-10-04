from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db import db_session
from app.services import storage, vision
from app.services.eventos import registrar_evento

router = APIRouter(prefix="/prendas", tags=["prendas"])

# fotos pendientes de confirmación: token -> {foto_url, atributos}
_PENDIENTES: dict[str, dict] = {}


@router.post("/foto")
async def subir_foto(archivo: UploadFile = File(...)):
    if archivo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato de imagen no soportado (usa jpg, png o webp)")

    contenido = await archivo.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(400, "La imagen es muy pesada (máx 8MB)")

    extension = Path(archivo.filename or "foto.jpg").suffix or ".jpg"
    try:
        foto_url = storage.subir_foto(contenido, archivo.content_type, extension)
    except Exception as exc:
        raise HTTPException(502, f"No se pudo guardar la imagen: {exc}") from exc

    ia_disponible = True
    try:
        atributos = vision.inferir_atributos(contenido, archivo.content_type)
    except Exception:
        ia_disponible = False
        atributos = {"tipo": "", "color": "", "formalidad": "casual", "abrigo": "medio"}

    token = uuid.uuid4().hex
    _PENDIENTES[token] = {"foto_url": foto_url, "atributos": atributos}

    with db_session() as conn:
        registrar_evento(conn, "foto_subida", payload={"token": token, "atributos": atributos, "ia_disponible": ia_disponible})

    return {
        "token": token,
        "atributos": atributos,
        "ia_disponible": ia_disponible,
        "foto_url": foto_url,
    }


@router.post("")
def confirmar_prenda(
    token: str = Form(...),
    tipo: str = Form(...),
    color: str = Form(...),
    formalidad: str = Form(...),
    abrigo: str = Form(...),
    zona_actual: str | None = Form(None),
    tag_uid: str | None = Form(None),
    marca: str | None = Form(None),
    material: str | None = Form(None),
    temporada: str | None = Form(None),
):
    pendiente = _PENDIENTES.pop(token, None)
    if pendiente is None:
        raise HTTPException(404, "No hay una foto pendiente con ese token (¿ya la confirmaste o expiró?)")

    ahora = datetime.now(timezone.utc).isoformat()
    with db_session() as conn:
        cursor = conn.execute(
            """INSERT INTO prenda (foto_path, tipo, color, formalidad, abrigo, tag_uid, zona_actual, marca, material, temporada, estado, creado_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible', ?) RETURNING id""",
            (pendiente["foto_url"], tipo, color, formalidad, abrigo, tag_uid, zona_actual, marca, material, temporada, ahora),
        )
        prenda_id = cursor.fetchone()["id"]
        registrar_evento(conn, "prenda_creada", prenda_id=prenda_id, payload={"tipo": tipo, "color": color})

    return {"id": prenda_id, "foto_path": pendiente["foto_url"]}


@router.get("")
def listar_prendas(estado: str | None = None, zona: str | None = None, tipo: str | None = None):
    query = "SELECT * FROM prenda WHERE 1=1"
    params = []
    if estado:
        query += " AND estado = ?"
        params.append(estado)
    if zona:
        query += " AND zona_actual = ?"
        params.append(zona)
    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    query += " ORDER BY creado_en DESC"

    with db_session() as conn:
        filas = conn.execute(query, params).fetchall()
    return [dict(f) for f in filas]


@router.get("/{prenda_id}")
def obtener_prenda(prenda_id: int):
    with db_session() as conn:
        fila = conn.execute("SELECT * FROM prenda WHERE id = ?", (prenda_id,)).fetchone()
    if fila is None:
        raise HTTPException(404, "Prenda no encontrada")
    return dict(fila)


@router.patch("/{prenda_id}")
def editar_prenda(prenda_id: int, cambios: dict):
    campos_permitidos = {
        "tipo",
        "color",
        "formalidad",
        "abrigo",
        "zona_actual",
        "estado",
        "tag_uid",
        "marca",
        "material",
        "temporada",
    }
    campos = {k: v for k, v in cambios.items() if k in campos_permitidos}
    if not campos:
        raise HTTPException(400, "No enviaste campos válidos para editar")

    set_clause = ", ".join(f"{k} = ?" for k in campos)
    with db_session() as conn:
        fila = conn.execute("SELECT id FROM prenda WHERE id = ?", (prenda_id,)).fetchone()
        if fila is None:
            raise HTTPException(404, "Prenda no encontrada")
        conn.execute(f"UPDATE prenda SET {set_clause} WHERE id = ?", (*campos.values(), prenda_id))
        registrar_evento(conn, "prenda_editada", prenda_id=prenda_id, payload=campos)

    return {"id": prenda_id, **campos}
