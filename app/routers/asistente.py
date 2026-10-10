from __future__ import annotations

import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.asistente import interpretar_comando, opinar_look

router = APIRouter(prefix="/asistente", tags=["asistente"])


class ComandoVoz(BaseModel):
    texto: str
    contexto: dict = {}


@router.post("/comando")
def comando(cmd: ComandoVoz):
    try:
        return interpretar_comando(cmd.texto, cmd.contexto)
    except Exception as exc:
        raise HTTPException(502, f"No se pudo interpretar el comando: {exc}") from exc


@router.post("/opinion-look")
async def opinion_look(
    archivo: UploadFile = File(...),
    piezas: str = Form("[]"),
    tono: str = Form("cercano"),
    nombre: str = Form(""),
):
    """Opinión sobre cómo se ve el look puesto. La foto se analiza al vuelo y no se guarda."""
    if archivo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato de imagen no soportado (usa jpg, png o webp)")
    contenido = await archivo.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(400, "La imagen es muy pesada (máx 8MB)")
    try:
        lista = json.loads(piezas)
    except ValueError:
        lista = []
    try:
        return {"opinion": opinar_look(contenido, archivo.content_type, lista, tono, nombre)}
    except Exception as exc:
        raise HTTPException(502, f"No se pudo analizar la foto: {exc}") from exc
