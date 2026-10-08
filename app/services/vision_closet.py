from __future__ import annotations

import base64
import json

from app.services.ai_client import MODEL, get_client

SCHEMA = {
    "name": "reconocimiento_closet",
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
                        "confianza": {"type": "number", "description": "0.0 a 1.0"},
                    },
                    "required": ["prenda_id", "confianza"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["coincidencias"],
        "additionalProperties": False,
    },
}

PROMPT = """Eres la cámara de un closet inteligente. Te doy una foto del closet y fotos de referencia de las
prendas guardadas (las referencias fueron tomadas aparte, con otra luz y fondo: compara color, forma, cuello,
cierres, rayas, estampados y logos, no el fondo).
Decide cuáles de las prendas guardadas aparecen en la foto del closet. Incluye solo las que reconozcas;
las que no veas, no las incluyas ni inventes ids. No repitas un id. Da una "confianza" honesta (0.0 a 1.0):
si dudas entre dos prendas parecidas, baja la confianza en vez de adivinar con seguridad falsa.

Responde solo JSON."""


def reconocer_closet(foto_bytes: bytes, mime_type: str, candidatas: list[dict]) -> list[dict]:
    if not candidatas:
        return []

    b64 = base64.b64encode(foto_bytes).decode("utf-8")
    contenido = [
        {"type": "text", "text": PROMPT},
        {"type": "text", "text": "Foto del closet:"},
        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
        {"type": "text", "text": "Prendas guardadas (id, tipo, color y su foto de referencia):"},
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
