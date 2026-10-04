from __future__ import annotations

import json

from app.services.ai_client import MODEL, get_client

ACCIONES = [
    "abrir_camara",
    "capturar_foto",
    "usar_foto",
    "repetir_foto",
    "cancelar",
    "guardar_prenda",
    "ver_combinaciones",
    "confirmar_conjunto",
    "cambiar_prenda",
    "otras_opciones",
    "preguntar",
    "desconocido",
]

OCASIONES = ["casual", "formal", "deportivo"]

SCHEMA = {
    "name": "comando_voz",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "accion": {"type": "string", "enum": ACCIONES},
            "parametro": {"type": ["string", "null"]},
            "ocasion": {"type": ["string", "null"], "enum": [*OCASIONES, None]},
            "respuesta_hablada": {"type": "string"},
        },
        "required": ["accion", "parametro", "ocasion", "respuesta_hablada"],
        "additionalProperties": False,
    },
}

PROMPT_BASE = """Eres el cerebro de un asistente de voz conversacional para un armario inteligente. El
usuario te habla y tú decides qué acción debe ejecutar la app, y qué le respondes en voz alta (breve,
cercano, en español).

Tienes memoria: en el contexto recibes "historial", la lista de turnos recientes de esta conversación
(quién dijo qué, y qué hiciste). Úsalo para:
- Resolver referencias ("sí", "ese no", "el otro", "mejor cambia igual la camisa") sin que el usuario
  tenga que repetir todo de nuevo.
- Saber si tu último turno fue una pregunta tuya (acción "preguntar") — si es así, interpreta lo que el
  usuario acaba de decir como la respuesta a ESA pregunta, no como un comando nuevo.

Puedes usar la acción "preguntar" cuando de verdad te falta un dato importante para ejecutar bien la
acción (ej. el usuario dice "recomiéndame algo" sin ninguna pista de ocasión y quieres saber si es para
algo casual, formal o deportivo). No abuses de preguntar: si puedes avanzar con una interpretación
razonable, hazlo directo sin preguntar. Cuando preguntes, no ejecutes ninguna otra acción en el mismo turno.

Para cualquier acción que SÍ ejecuta algo en la app (todas menos "preguntar" y "desconocido"), confirma en
"respuesta_hablada" que ya lo estás haciendo — nunca preguntes si quiere continuar cuando vas a ejecutar.

Acciones posibles, según la etapa actual de la app (etapa en el contexto):
- preguntar: haz una pregunta de seguimiento necesaria antes de actuar; no cambia la etapa ni ejecuta nada.
- abrir_camara: el usuario quiere sacar una foto de una prenda nueva (solo tiene sentido en etapa "inicio").
- capturar_foto: tomar la foto ahora mismo (solo con etapa "camara_abierta").
- usar_foto: confirmar que la foto recién capturada sirve y seguir (solo con etapa "foto_capturada").
- repetir_foto: la foto no sirvió, tomar otra (solo con etapa "foto_capturada").
- cancelar: cancelar el proceso de subir una prenda y volver al inicio.
- guardar_prenda: guardar la prenda en el armario con los atributos que ya detectó la IA (solo con etapa "confirmando_atributos").
- ver_combinaciones: pedir sugerencias de qué ponerse (etapa "inicio"). Además, completa "ocasion" con
  "casual", "formal" o "deportivo" según lo que describe el usuario (ej. "cita elegante", "entrevista de
  trabajo", "matrimonio" -> formal; "ir al gimnasio", "salir a correr" -> deportivo; si no dice nada
  relacionado, deja ocasion en null).
- confirmar_conjunto: aceptar el conjunto de ropa que se le mostró (etapa "mostrando_combinaciones").
- cambiar_prenda: pide cambiar una pieza específica del conjunto; en "parametro" pon el tipo de prenda
  mencionado (ej. "camisa"), basándote en las piezas listadas en el contexto.
- otras_opciones: pedir otro conjunto distinto (etapa "mostrando_combinaciones").
- desconocido: si lo que dijo no tiene sentido para la etapa actual, o no entendiste.

Para cualquier acción que no sea "ver_combinaciones", deja "ocasion" en null.
Si la acción no es válida para la etapa actual, responde "desconocido" y explica brevemente qué puede hacer ahora.
Responde solo JSON, sin explicaciones fuera del JSON."""


def _detectar_ocasion(t: str) -> str | None:
    if any(p in t for p in ["elegante", "formal", "entrevista", "matrimonio", "oficina", "reunión", "reunion", "cita"]):
        return "formal"
    if any(p in t for p in ["deporte", "gimnasio", "gym", "correr", "entrenar", "ejercicio"]):
        return "deportivo"
    return None


def _interpretar_con_reglas(transcripcion: str, contexto: dict) -> dict:
    """Respaldo sin IA por si la IA no responde: cubre los comandos más comunes por etapa."""
    t = transcripcion.lower()
    etapa = contexto.get("etapa", "inicio")

    def resultado(accion: str, hablada: str, parametro: str = "", ocasion: str | None = None) -> dict:
        return {"accion": accion, "parametro": parametro, "ocasion": ocasion, "respuesta_hablada": hablada}

    if etapa == "inicio":
        if any(p in t for p in ["foto", "subir", "escane", "agregar prenda"]):
            return resultado("abrir_camara", "Abro la cámara.")
        if any(p in t for p in ["combina", "ponerme", "vestir", "recomien", "sugerencia"]):
            return resultado("ver_combinaciones", "Buscando una combinación para ti.", ocasion=_detectar_ocasion(t))
    elif etapa == "camara_abierta":
        if any(p in t for p in ["captura", "toma", "saca", "ahora"]):
            return resultado("capturar_foto", "Capturando.")
        if "cancel" in t:
            return resultado("cancelar", "Cancelado.")
    elif etapa == "foto_capturada":
        if any(p in t for p in ["usar", "sirve", "guard", "sí", "listo", "buena"]):
            return resultado("usar_foto", "Perfecto, sigo con esa foto.")
        if any(p in t for p in ["repet", "otra", "de nuevo", "mala"]):
            return resultado("repetir_foto", "Tomemos otra.")
    elif etapa == "confirmando_atributos":
        if any(p in t for p in ["guard", "sí", "listo", "confirma"]):
            return resultado("guardar_prenda", "Guardado en tu armario.")
        if "cancel" in t:
            return resultado("cancelar", "Cancelado.")
    elif etapa == "mostrando_combinaciones":
        if any(p in t for p in ["confirma", "me gusta", "ese", "listo", "sí"]):
            return resultado("confirmar_conjunto", "Dale, confirmado.")
        if any(p in t for p in ["otra", "otras opciones", "no me gusta", "distinto"]):
            return resultado("otras_opciones", "Buscando otra opción.")
        if "cambia" in t:
            piezas = contexto.get("piezas_conjunto") or []
            for tipo in piezas:
                if tipo.lower() in t:
                    return resultado("cambiar_prenda", f"Cambiando {tipo}.", parametro=tipo)

    return resultado("desconocido", "No te entendí bien. ¿Puedes repetirlo?")


def interpretar_comando(transcripcion: str, contexto: dict) -> dict:
    prompt = f"{PROMPT_BASE}\n\nContexto actual: {json.dumps(contexto, ensure_ascii=False)}\nEl usuario dijo: \"{transcripcion}\""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_schema", "json_schema": SCHEMA},
        )
        return json.loads(response.choices[0].message.content)
    except Exception:
        return _interpretar_con_reglas(transcripcion, contexto)
