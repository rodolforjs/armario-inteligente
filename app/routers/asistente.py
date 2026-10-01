from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.asistente import interpretar_comando

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
