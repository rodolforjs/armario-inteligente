from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import db_session
from app.services import estado_led
from app.services.eventos import registrar_evento
from app.services.recomendacion import MODOS, generar_recomendacion

router = APIRouter(prefix="/recomendaciones", tags=["recomendaciones"])


class SolicitudRecomendacion(BaseModel):
    modo: str = "exploratorio"  # "exploratorio" | "pocas_opciones" | "preciso"
    ocasion: str | None = None
    texto_libre: str | None = None


class AceptarConjunto(BaseModel):
    prenda_ids: list[int]


class RechazarPrenda(BaseModel):
    conjunto_idx: int
    prenda_id: int


def _cargar_sesion(conn, sesion_id: str):
    fila = conn.execute("SELECT * FROM sesion_recomendacion WHERE id = ?", (sesion_id,)).fetchone()
    if fila is None:
        raise HTTPException(404, "Sesión no encontrada")
    return dict(fila)


def _prendas_disponibles(conn) -> list[dict]:
    filas = conn.execute("SELECT * FROM prenda WHERE estado = 'disponible'").fetchall()
    return [dict(f) for f in filas]


def _encender_zonas_de(conn, conjunto: dict, motivo: str):
    prenda_ids = conjunto["prenda_ids"]
    if not prenda_ids:
        estado_led.apagar_todo()
        return
    placeholders = ",".join("?" for _ in prenda_ids)
    filas = conn.execute(
        f"SELECT DISTINCT zona_actual FROM prenda WHERE id IN ({placeholders}) AND zona_actual IS NOT NULL",
        prenda_ids,
    ).fetchall()
    zonas = [f["zona_actual"] for f in filas]
    estado_led.set_zonas(zonas, motivo)


@router.post("")
def solicitar_recomendacion(solicitud: SolicitudRecomendacion):
    if solicitud.modo not in MODOS:
        raise HTTPException(400, f"modo debe ser uno de: {list(MODOS)}")

    with db_session() as conn:
        disponibles = _prendas_disponibles(conn)
        if not disponibles:
            raise HTTPException(409, "No hay prendas disponibles en el armario ahora mismo")

        resultado = generar_recomendacion(disponibles, solicitud.ocasion, solicitud.texto_libre, solicitud.modo)

        if not resultado["conjuntos"]:
            raise HTTPException(409, "No se pudo armar ningún conjunto con el inventario disponible")

        sesion_id = uuid.uuid4().hex
        ahora = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO sesion_recomendacion
               (id, ocasion, texto_libre, modo, clima_json, conjuntos_json, rechazos_count, estado, creado_en)
               VALUES (?, ?, ?, ?, ?, ?, 0, 'en_curso', ?)""",
            (
                sesion_id,
                solicitud.ocasion,
                solicitud.texto_libre,
                solicitud.modo,
                json.dumps(resultado["clima"], ensure_ascii=False),
                json.dumps(resultado["conjuntos"], ensure_ascii=False),
                ahora,
            ),
        )
        registrar_evento(
            conn,
            "recomendacion_solicitada",
            sesion_id=sesion_id,
            payload={"modo": solicitud.modo, "ocasion": solicitud.ocasion},
        )
        _encender_zonas_de(conn, resultado["conjuntos"][0], "Conjunto recomendado")

    return {"sesion_id": sesion_id, "clima": resultado["clima"], "conjuntos": resultado["conjuntos"]}


@router.get("/{sesion_id}")
def obtener_sesion(sesion_id: str):
    with db_session() as conn:
        sesion = _cargar_sesion(conn, sesion_id)
    sesion["clima"] = json.loads(sesion.pop("clima_json") or "{}")
    sesion["conjuntos"] = json.loads(sesion.pop("conjuntos_json") or "[]")
    return sesion


@router.post("/{sesion_id}/aceptar")
def aceptar_conjunto(sesion_id: str, aceptar: AceptarConjunto):
    ahora = datetime.now(timezone.utc).isoformat()
    with db_session() as conn:
        sesion = _cargar_sesion(conn, sesion_id)
        conn.execute(
            "UPDATE sesion_recomendacion SET estado = 'confirmada', confirmada_en = ? WHERE id = ?",
            (ahora, sesion_id),
        )
        for prenda_id in aceptar.prenda_ids:
            conn.execute(
                "UPDATE prenda SET veces_usada = veces_usada + 1, fecha_ultimo_uso = ? WHERE id = ?",
                (ahora, prenda_id),
            )
            registrar_evento(conn, "prenda_aceptada", sesion_id=sesion_id, prenda_id=prenda_id)
        estado_led.set_zonas([], "")

    return {"ok": True, "sesion_id": sesion_id, "estado": "confirmada"}


@router.post("/{sesion_id}/rechazar-prenda")
def rechazar_prenda(sesion_id: str, rechazo: RechazarPrenda):
    with db_session() as conn:
        sesion = _cargar_sesion(conn, sesion_id)
        conjuntos = json.loads(sesion["conjuntos_json"] or "[]")
        if not (0 <= rechazo.conjunto_idx < len(conjuntos)):
            raise HTTPException(400, "conjunto_idx fuera de rango")

        conjunto = conjuntos[rechazo.conjunto_idx]
        ids_actuales = {p["id"] for p in conjunto["piezas"]}
        if rechazo.prenda_id not in ids_actuales:
            raise HTTPException(400, "Esa prenda no pertenece a ese conjunto")

        ids_ya_usados = {pid for c in conjuntos for pid in c["prenda_ids"]}
        disponibles = _prendas_disponibles(conn)
        candidatas = [p for p in disponibles if p["id"] not in ids_ya_usados]

        pieza_a_reemplazar = next(p for p in conjunto["piezas"] if p["id"] == rechazo.prenda_id)
        tipo_objetivo = pieza_a_reemplazar["tipo"]
        reemplazo = next((p for p in candidatas if p["tipo"] == tipo_objetivo), None)
        reemplazo = reemplazo or next(iter(candidatas), None)

        if reemplazo is None:
            raise HTTPException(409, "No queda ninguna prenda disponible para sustituir")

        reemplazo_pieza = {
            "id": reemplazo["id"],
            "tipo": reemplazo["tipo"],
            "color": reemplazo["color"],
            "foto_path": reemplazo["foto_path"],
        }
        conjunto["piezas"] = [
            reemplazo_pieza if p["id"] == rechazo.prenda_id else p for p in conjunto["piezas"]
        ]
        conjunto["prenda_ids"] = [p["id"] for p in conjunto["piezas"]]
        conjuntos[rechazo.conjunto_idx] = conjunto

        conn.execute(
            "UPDATE sesion_recomendacion SET conjuntos_json = ? WHERE id = ?",
            (json.dumps(conjuntos, ensure_ascii=False), sesion_id),
        )
        registrar_evento(
            conn,
            "prenda_rechazada",
            sesion_id=sesion_id,
            prenda_id=rechazo.prenda_id,
            payload={"reemplazo_id": reemplazo["id"]},
        )
        _encender_zonas_de(conn, conjunto, "Conjunto actualizado")

    return {"sesion_id": sesion_id, "conjuntos": conjuntos}


@router.post("/{sesion_id}/rechazar-conjunto")
def rechazar_conjunto(sesion_id: str):
    with db_session() as conn:
        sesion = _cargar_sesion(conn, sesion_id)
        nuevos_rechazos = sesion["rechazos_count"] + 1

        if nuevos_rechazos >= 2:
            conn.execute(
                "UPDATE sesion_recomendacion SET rechazos_count = ?, estado = 'modo_libre' WHERE id = ?",
                (nuevos_rechazos, sesion_id),
            )
            registrar_evento(conn, "modo_libre_activado", sesion_id=sesion_id)
            estado_led.apagar_todo()
            return {"sesion_id": sesion_id, "estado": "modo_libre"}

        disponibles = _prendas_disponibles(conn)
        resultado = generar_recomendacion(disponibles, sesion["ocasion"], sesion["texto_libre"], sesion["modo"])
        if not resultado["conjuntos"]:
            raise HTTPException(409, "No se pudo armar otro conjunto con el inventario disponible")

        conn.execute(
            """UPDATE sesion_recomendacion
               SET rechazos_count = ?, conjuntos_json = ?, clima_json = ?
               WHERE id = ?""",
            (
                nuevos_rechazos,
                json.dumps(resultado["conjuntos"], ensure_ascii=False),
                json.dumps(resultado["clima"], ensure_ascii=False),
                sesion_id,
            ),
        )
        registrar_evento(conn, "conjunto_rechazado", sesion_id=sesion_id, payload={"rechazos_count": nuevos_rechazos})
        _encender_zonas_de(conn, resultado["conjuntos"][0], "Nuevo conjunto recomendado")

    return {"sesion_id": sesion_id, "estado": "en_curso", "clima": resultado["clima"], "conjuntos": resultado["conjuntos"]}
