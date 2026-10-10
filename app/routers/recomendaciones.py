from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import db_session
from app.services.eventos import registrar_evento
from app.services.recomendacion import MODOS, _aplicar_preferencias, _categoria_prenda, generar_recomendacion

router = APIRouter(prefix="/recomendaciones", tags=["recomendaciones"])


class SolicitudRecomendacion(BaseModel):
    modo: str = "exploratorio"  # "exploratorio" | "pocas_opciones" | "preciso"
    ocasion: str | None = None
    texto_libre: str | None = None
    preferencias: dict | None = None


class AceptarConjunto(BaseModel):
    prenda_ids: list[int]


class ValoracionLook(BaseModel):
    prenda_ids: list[int]
    valor: int  # 1 me encantó, 0 está bien, -1 no me convenció


class RechazarPrenda(BaseModel):
    conjunto_idx: int
    prenda_id: int


def _cargar_sesion(conn, sesion_id: str):
    fila = conn.execute("SELECT * FROM sesion_recomendacion WHERE id = ?", (sesion_id,)).fetchone()
    if fila is None:
        raise HTTPException(404, "Sesión no encontrada")
    return dict(fila)


def _afinidades(conn) -> dict[int, int]:
    """Suma de valoraciones (+1 me encantó, -1 no me convenció) por prenda."""
    totales: dict[int, int] = {}
    for fila in conn.execute("SELECT payload_json FROM evento_log WHERE tipo = 'look_valorado'").fetchall():
        try:
            datos = json.loads(fila["payload_json"] or "{}")
        except ValueError:
            continue
        for pid in datos.get("prenda_ids", []):
            totales[pid] = totales.get(pid, 0) + int(datos.get("valor", 0))
    return totales


def _prendas_disponibles(conn) -> list[dict]:
    filas = conn.execute("SELECT * FROM prenda WHERE estado = 'disponible'").fetchall()
    afinidad = _afinidades(conn)
    prendas = [dict(f) for f in filas]
    for p in prendas:
        p["afinidad"] = afinidad.get(p["id"], 0)
    return prendas


@router.post("")
def solicitar_recomendacion(solicitud: SolicitudRecomendacion):
    if solicitud.modo not in MODOS:
        raise HTTPException(400, f"modo debe ser uno de: {list(MODOS)}")

    with db_session() as conn:
        disponibles = _prendas_disponibles(conn)
        if not disponibles:
            raise HTTPException(409, "No hay prendas disponibles en el armario ahora mismo")

        resultado = generar_recomendacion(
            disponibles, solicitud.ocasion, solicitud.texto_libre, solicitud.modo, solicitud.preferencias
        )

        if not resultado["conjuntos"]:
            cats = [_categoria_prenda(p["tipo"]) for p in disponibles]
            faltan = []
            if "completo" not in cats and "superior" not in cats:
                faltan.append("ropa de arriba (polera, camisa, polerón...)")
            if "completo" not in cats and "inferior" not in cats:
                faltan.append("ropa de abajo (pantalón, short...)")
            if solicitud.preferencias and not faltan:
                raise HTTPException(409, "Con ese criterio no pude armar ningún conjunto. Prueba con otro ajuste.")
            detalle = f" Te falta {' y '.join(faltan)} disponible: revisa que no esté marcada como fuera del closet." if faltan else ""
            raise HTTPException(409, f"No se pudo armar ningún conjunto con lo que hay disponible.{detalle}")

        sesion_id = uuid.uuid4().hex
        ahora = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO sesion_recomendacion
               (id, ocasion, texto_libre, modo, clima_json, conjuntos_json, rechazos_count, estado, creado_en,
                preferencias_json)
               VALUES (?, ?, ?, ?, ?, ?, 0, 'en_curso', ?, ?)""",
            (
                sesion_id,
                solicitud.ocasion,
                solicitud.texto_libre,
                solicitud.modo,
                json.dumps(resultado["clima"], ensure_ascii=False),
                json.dumps(resultado["conjuntos"], ensure_ascii=False),
                ahora,
                json.dumps(solicitud.preferencias, ensure_ascii=False) if solicitud.preferencias else None,
            ),
        )
        registrar_evento(
            conn,
            "recomendacion_solicitada",
            sesion_id=sesion_id,
            payload={"modo": solicitud.modo, "ocasion": solicitud.ocasion},
        )

    return {"sesion_id": sesion_id, "clima": resultado["clima"], "conjuntos": resultado["conjuntos"]}


@router.post("/valorar")
def valorar_look(valoracion: ValoracionLook):
    if valoracion.valor not in (-1, 0, 1):
        raise HTTPException(400, "valor debe ser -1, 0 o 1")
    with db_session() as conn:
        registrar_evento(
            conn,
            "look_valorado",
            payload={"prenda_ids": valoracion.prenda_ids, "valor": valoracion.valor},
        )
    return {"ok": True}


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

        pieza_a_reemplazar = next(p for p in conjunto["piezas"] if p["id"] == rechazo.prenda_id)
        tipo_objetivo = pieza_a_reemplazar["tipo"]
        categoria = _categoria_prenda(tipo_objetivo)
        es_extra = categoria in ("calzado", "accesorio")

        # Las prendas base no se repiten entre opciones; calzado y accesorios sí pueden repetirse entre opciones.
        if es_extra:
            ids_excluidos = set(conjunto["prenda_ids"])
        else:
            ids_excluidos = {pid for c in conjuntos for pid in c["prenda_ids"]}
        disponibles = _prendas_disponibles(conn)
        candidatas = [p for p in disponibles if p["id"] not in ids_excluidos]
        if sesion.get("preferencias_json"):
            candidatas = _aplicar_preferencias(candidatas, json.loads(sesion["preferencias_json"]))

        # Solo se reemplaza por algo del mismo tipo o, si no hay, de la misma categoría (nunca un pantalón por zapatos).
        reemplazo = next((p for p in candidatas if p["tipo"] == tipo_objetivo), None)
        reemplazo = reemplazo or next((p for p in candidatas if _categoria_prenda(p["tipo"]) == categoria), None)

        if reemplazo is None:
            raise HTTPException(409, f"No tengo otra prenda disponible como «{tipo_objetivo}» para cambiar.")

        reemplazo_pieza = {
            "id": reemplazo["id"],
            "tipo": reemplazo["tipo"],
            "color": reemplazo["color"],
            "formalidad": reemplazo["formalidad"],
            "abrigo": reemplazo["abrigo"],
            "foto_path": reemplazo["foto_path"],
            "rol": pieza_a_reemplazar.get("rol", "base"),
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
            return {"sesion_id": sesion_id, "estado": "modo_libre"}

        disponibles = _prendas_disponibles(conn)
        preferencias = json.loads(sesion["preferencias_json"]) if sesion.get("preferencias_json") else None
        resultado = generar_recomendacion(
            disponibles, sesion["ocasion"], sesion["texto_libre"], sesion["modo"], preferencias
        )
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

    return {"sesion_id": sesion_id, "estado": "en_curso", "clima": resultado["clima"], "conjuntos": resultado["conjuntos"]}
