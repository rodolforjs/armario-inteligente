from __future__ import annotations

import json

from app.db import db_session
from app.services import clima as clima_service
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
    "responder",
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
            "preferencias": {
                "type": ["object", "null"],
                "properties": {
                    "evitar_colores": {"type": "array", "items": {"type": "string"}},
                    "preferir_colores": {"type": "array", "items": {"type": "string"}},
                    "abrigo": {"type": ["string", "null"], "enum": ["mas_abrigado", "mas_liviano", None]},
                },
                "required": ["evitar_colores", "preferir_colores", "abrigo"],
                "additionalProperties": False,
            },
            "seguir_escuchando": {"type": "boolean"},
            "respuesta_hablada": {"type": "string"},
        },
        "required": ["accion", "parametro", "ocasion", "preferencias", "seguir_escuchando", "respuesta_hablada"],
        "additionalProperties": False,
    },
}

PROMPT_BASE = """Eres {nombre}, el asistente personal de un armario inteligente: conoces la ropa de la persona, el\nclima y lo que ha elegido antes. Conversas con naturalidad en español y, cuando corresponde, decides qué\nacción ejecuta la app. {tono}\n\nIMPORTANTE: en "datos_closet" del contexto tienes el inventario real, el clima y las últimas decisiones.\nÚsalos para responder con precisión; NUNCA inventes prendas que no estén en esa lista.\n"en_el_closet" son las prendas disponibles ahora; "fuera_del_closet" son prendas que la persona tiene pero no están ahí\nahora (en uso, en el lavado...): si preguntan por ellas, dilo así, no las ofrezcas ni digas que están en el closet.

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
- responder: conversar sin ejecutar nada en la app. Úsalo para preguntas o comentarios: qué prendas tiene
  ("¿tengo algo azul?", "¿cuántas poleras hay?"), por qué elegiste el look en pantalla ("piezas_conjunto" y
  "razon_conjunto" del contexto), qué ponerse según el clima, consejos de estilo, charla breve. Responde en
  1-3 frases con datos reales. Sirve en cualquier etapa.
- desconocido: solo si el audio es ininteligible. Si algo no tiene que ver con la ropa, usa "responder" con
  una frase amable que lo reconduzca.

AJUSTES CON CRITERIO: si el usuario pide un cambio de criterio sobre los looks ("algo más abrigado", "sin
azul", "con más color", "más liviano", "¿y si llueve?"), usa "ver_combinaciones" y rellena "preferencias"
(evitar_colores, preferir_colores y abrigo mas_abrigado/mas_liviano; listas vacías y null si no aplican).
Conserva la "ocasion_actual" del contexto si el usuario no la cambia, y suma "preferencias_actuales" a las
nuevas en vez de olvidarlas. En las demás acciones deja "preferencias" en null.

"seguir_escuchando": true cuando tu respuesta termina en una pregunta o esperas que la persona conteste
(siempre con "preguntar"); false en el resto.

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
        return {
            "accion": accion,
            "parametro": parametro,
            "ocasion": ocasion,
            "preferencias": None,
            "seguir_escuchando": False,
            "respuesta_hablada": hablada,
        }

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


TONOS = {
    "cercano": "Tu tono es cercano y cálido, como un amigo con buen ojo para la ropa.",
    "formal": "Tu tono es formal y elegante, como un asesor de imagen: educado, preciso, sin muletillas.",
    "divertido": "Tu tono es divertido y con humor liviano, sin pasarte; puedes bromear un poco.",
    "breve": "Tu tono es directo y minimalista: respuestas de una frase, sin adornos.",
}


def _contexto_closet() -> dict:
    """Inventario, clima y decisiones recientes, para que el asistente conteste con datos reales."""
    datos: dict = {}
    try:
        with db_session() as conn:
            prendas = [dict(f) for f in conn.execute("SELECT * FROM prenda ORDER BY id").fetchall()]
            eventos = [
                dict(f)
                for f in conn.execute(
                    """SELECT e.tipo, p.tipo AS ptipo, p.color AS pcolor
                       FROM evento_log e LEFT JOIN prenda p ON p.id = e.prenda_id
                       WHERE e.tipo IN ('prenda_aceptada', 'prenda_rechazada', 'conjunto_rechazado')
                       ORDER BY e.timestamp DESC LIMIT 12"""
                ).fetchall()
            ]
        datos["en_el_closet"] = [
            f"{p['tipo']} {p['color']} ({p['formalidad']}, abrigo {p['abrigo']}, usada {p['veces_usada']}x)"
            for p in prendas
            if p["estado"] == "disponible"
        ]
        datos["fuera_del_closet"] = [f"{p['tipo']} {p['color']}" for p in prendas if p["estado"] != "disponible"]
        etiquetas = {
            "prenda_aceptada": "se puso",
            "prenda_rechazada": "cambió",
            "conjunto_rechazado": "rechazó un look",
        }
        datos["decisiones_recientes"] = [
            f"{etiquetas[e['tipo']]}{' ' + e['ptipo'] + ' ' + e['pcolor'] if e['ptipo'] else ''}" for e in eventos
        ]
    except Exception:
        pass
    try:
        datos["clima"] = clima_service.obtener_clima_actual()
    except Exception:
        pass
    return datos


def interpretar_comando(transcripcion: str, contexto: dict) -> dict:
    persona = contexto.get("persona") or {}
    nombre = str(persona.get("nombre") or "tu asistente")[:30]
    tono = TONOS.get(persona.get("tono"), TONOS["cercano"])
    contexto = {k: v for k, v in contexto.items() if k != "persona"}
    contexto["datos_closet"] = _contexto_closet()

    base = PROMPT_BASE.replace("{nombre}", nombre).replace("{tono}", tono)
    prompt = f"{base}\n\nContexto actual: {json.dumps(contexto, ensure_ascii=False)}\nEl usuario dijo: \"{transcripcion}\""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_schema", "json_schema": SCHEMA},
        )
        resultado = json.loads(response.choices[0].message.content)
        # Solo se reabre el micrófono cuando de verdad se espera una respuesta, no al ejecutar una acción.
        if resultado["accion"] not in ("preguntar", "responder"):
            resultado["seguir_escuchando"] = False
        return resultado
    except Exception:
        return _interpretar_con_reglas(transcripcion, contexto)
