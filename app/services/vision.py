from __future__ import annotations

import json
import os

from google import genai
from google.genai import types

_client: genai.Client | None = None

ATRIBUTOS_SCHEMA = {
    "type": "object",
    "properties": {
        "tipo": {"type": "string", "description": "ej. camisa, polera, pantalón, chaqueta, vestido, falda, polerón"},
        "color": {"type": "string", "description": "color principal de la prenda"},
        "formalidad": {"type": "string", "enum": ["casual", "formal", "deportivo"]},
        "abrigo": {"type": "string", "enum": ["liviano", "medio", "abrigado"]},
    },
    "required": ["tipo", "color", "formalidad", "abrigo"],
}

PROMPT = (
    "Eres un asistente de moda. Observa la foto de esta prenda de ropa y describe "
    "sus atributos. Responde solo con el JSON pedido, sin explicaciones."
)


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Falta la variable de entorno GEMINI_API_KEY")
        _client = genai.Client(api_key=api_key)
    return _client


def inferir_atributos(imagen_bytes: bytes, mime_type: str) -> dict:
    client = get_client()
    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=[
            types.Part.from_bytes(data=imagen_bytes, mime_type=mime_type),
            PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ATRIBUTOS_SCHEMA,
        ),
    )
    return json.loads(response.text)
