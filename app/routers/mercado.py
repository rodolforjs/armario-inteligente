from __future__ import annotations

from fastapi import APIRouter

from app.db import db_session
from app.services import clima as clima_service
from app.services import mercado

router = APIRouter(prefix="/mercado", tags=["mercado"])


@router.get("/sugerencias")
def sugerencias():
    with db_session() as conn:
        prendas = [dict(f) for f in conn.execute("SELECT * FROM prenda").fetchall()]
    try:
        clima = clima_service.obtener_clima_actual()
    except Exception:
        clima = None
    return {"simulacion": True, "sugerencias": mercado.sugerir(prendas, clima)}
