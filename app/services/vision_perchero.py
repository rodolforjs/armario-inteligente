from __future__ import annotations

import base64
import json

from app.services.ai_client import MODEL, get_client

SCHEMA = {
    "name": "reconocimiento_perchero",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "coincidencias": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "prenda_id": {"type": "integer"},
                        "posicion_relativa": {
                            "type": "number",
                            "description": "0.0 = extremo izquierdo de la foto, 1.0 = extremo derecho",
                        },
                        "confianza": {"type": "number", "description": "0.0 a 1.0"},
                    },
                    "required": ["prenda_id", "posicion_relativa", "confianza"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["coincidencias"],
        "additionalProperties": False,
    },
}

PROMPT = """Eres un sistema de visión que identifica prendas colgadas en el perchero de un armario.

Te doy una foto del perchero completo, y una lista de prendas candidatas (cada una con su foto de
referencia individual, tomada por separado). Tu trabajo es decidir cuáles de esas prendas candidatas
aparecen colgadas en la foto del perchero, y en qué posición horizontal (0.0 = extremo izquierdo de la
foto, 1.0 = extremo derecho).

No todas las candidatas tienen que estar en la foto — solo incluye las que de verdad reconozcas con
cierta seguridad. Si una prenda del perchero no se parece a ninguna candidata, simplemente no la
incluyas (no inventes ids). Para cada coincidencia, da un "confianza" honesto (0.0 a 1.0): si dudas
entre dos prendas parecidas, baja la confianza en vez de adivinar con seguridad falsa.

Responde solo JSON."""


def reconocer_perchero(foto_perchero_bytes: bytes, mime_type: str, candidatas: list[dict]) -> list[dict]:
    if not candidatas:
        return []

    b64 = base64.b64encode(foto_perchero_bytes).decode("utf-8")
    contenido = [
        {"type": "text", "text": PROMPT},
        {"type": "text", "text": "Foto del perchero completo:"},
        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
        {"type": "text", "text": "Prendas candidatas (id, tipo, color y su foto de referencia):"},
    ]
    for c in candidatas:
        contenido.append(
            {"type": "text", "text": f"id={c['id']}: {c['tipo']} {c['color']}"}
        )
        contenido.append({"type": "image_url", "image_url": {"url": c["foto_path"]}})

    client = get_client()
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": contenido}],
        response_format={"type": "json_schema", "json_schema": SCHEMA},
    )
    data = json.loads(response.choices[0].message.content)
    return data["coincidencias"]
