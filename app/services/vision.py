import base64
import json

from app.services.ai_client import MODEL, get_client

ATRIBUTOS_SCHEMA = {
    "name": "atributos_prenda",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "tipo": {"type": "string", "description": "ej. camisa, polera, pantalón, chaqueta, vestido, falda, polerón"},
            "color": {"type": "string", "description": "color principal de la prenda"},
            "formalidad": {"type": "string", "enum": ["casual", "formal", "deportivo"]},
            "abrigo": {"type": "string", "enum": ["liviano", "medio", "abrigado"]},
        },
        "required": ["tipo", "color", "formalidad", "abrigo"],
        "additionalProperties": False,
    },
}

PROMPT = (
    "Eres un asistente de moda. Observa la foto de esta prenda de ropa y describe "
    "sus atributos. Responde solo con el JSON pedido, sin explicaciones."
)


def inferir_atributos(imagen_bytes: bytes, mime_type: str) -> dict:
    client = get_client()
    b64 = base64.b64encode(imagen_bytes).decode("utf-8")
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                ],
            }
        ],
        response_format={"type": "json_schema", "json_schema": ATRIBUTOS_SCHEMA},
    )
    return json.loads(response.choices[0].message.content)
