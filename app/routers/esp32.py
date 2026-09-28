from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import db_session
from app.services import estado_led
from app.services.eventos import registrar_evento

router = APIRouter(tags=["esp32"])


class EventoNFC(BaseModel):
    uid: str
    zona: str
    tipo: str  # "visto" | "perdido"


@router.post("/eventos/nfc")
def evento_nfc(evento: EventoNFC):
    if evento.tipo not in ("visto", "perdido"):
        raise HTTPException(400, "tipo debe ser 'visto' o 'perdido'")

    with db_session() as conn:
        prenda = conn.execute("SELECT * FROM prenda WHERE tag_uid = ?", (evento.uid,)).fetchone()
        if prenda is None:
            raise HTTPException(404, f"No hay ninguna prenda registrada con el tag {evento.uid}")

        if evento.tipo == "visto":
            conn.execute(
                "UPDATE prenda SET estado = 'disponible', zona_actual = ? WHERE id = ?",
                (evento.zona, prenda["id"]),
            )
        else:
            conn.execute(
                "UPDATE prenda SET estado = 'fuera' WHERE id = ?",
                (prenda["id"],),
            )

        registrar_evento(
            conn,
            f"nfc_{evento.tipo}",
            prenda_id=prenda["id"],
            payload={"uid": evento.uid, "zona": evento.zona},
        )

    return {"ok": True, "prenda_id": prenda["id"], "estado": "disponible" if evento.tipo == "visto" else "fuera"}


@router.get("/leds/estado")
def estado_leds():
    return estado_led.obtener_estado()
