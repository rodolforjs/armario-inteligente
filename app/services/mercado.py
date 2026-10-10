from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote_plus

from app.services.ai_client import MODEL, get_client
from app.services.recomendacion import _normalizar

CATALOGO = json.loads((Path(__file__).resolve().parent.parent / "data" / "catalogo_mercado.json").read_text("utf-8"))
MAX_SUGERENCIAS = 5

# Catálogo curado de ejemplo (simulación): no hay API pública de H&M ni Zara, así que el enlace lleva a la
# búsqueda de la tienda, sin precios ni fotos inventados.
URLS = {
    "H&M": "https://www2.hm.com/es_cl/search-results.html?q={q}",
    "Zara": "https://www.zara.com/cl/es/search?searchTerm={q}",
}


def _con_url(item: dict, motivo: str) -> dict:
    return {**item, "motivo": motivo, "url": URLS[item["marca"]].format(q=quote_plus(item["busqueda"]))}


def _ya_lo_tiene(item: dict, prendas: list[dict]) -> bool:
    tipo, color = _normalizar(item["tipo"]), _normalizar(item["color"])
    return any(
        _normalizar(p["tipo"]) == tipo and (color in _normalizar(p["color"]) or _normalizar(p["color"]) in color)
        for p in prendas
    )


def _respaldo(candidatos: list[dict], prendas: list[dict]) -> list[dict]:
    """Sin IA: prioriza categorías con menos prendas en el closet."""
    from app.services.recomendacion import _categoria_prenda

    cuenta: dict[str, int] = {}
    for p in prendas:
        cat = _categoria_prenda(p["tipo"])
        cuenta[cat] = cuenta.get(cat, 0) + 1
    orden = sorted(candidatos, key=lambda i: cuenta.get(i["categoria"], 0))
    return [_con_url(i, f"Te faltan prendas de tipo {i['categoria']} y esta combina con lo que ya tienes.") for i in orden[:MAX_SUGERENCIAS]]


def sugerir(prendas: list[dict], clima: dict | None) -> list[dict]:
    candidatos = [i for i in CATALOGO if not _ya_lo_tiene(i, prendas)]
    if not candidatos:
        return []

    closet = [
        f"{p['tipo']} {p['color']} ({p['formalidad']}, abrigo {p['abrigo']})" for p in prendas
    ]
    catalogo = [
        {"id": i["id"], "nombre": i["nombre"], "marca": i["marca"], "formalidad": i["formalidad"], "abrigo": i["abrigo"]}
        for i in candidatos
    ]
    prompt = (
        "Eres el asesor de compras de un armario inteligente. Mira lo que la persona YA tiene y elige hasta "
        f"{MAX_SUGERENCIAS} prendas del catálogo que más le sirvan: que rellenen huecos (ej. no tiene abrigos, "
        "calzado de otra formalidad, prendas formales o deportivas), que combinen con sus colores y que sirvan para "
        "el clima actual. Mezcla las dos marcas si tiene sentido. Para cada una escribe un motivo breve (máx 18 "
        "palabras, español cercano) que cite algo concreto de su closet. Usa solo ids del catálogo.\n\n"
        f"Closet: {json.dumps(closet, ensure_ascii=False)}\n"
        f"Clima: {json.dumps(clima or {}, ensure_ascii=False)}\n"
        f"Catálogo: {json.dumps(catalogo, ensure_ascii=False)}"
    )
    try:
        response = get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "sugerencias_mercado",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "sugerencias": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"id": {"type": "string"}, "motivo": {"type": "string"}},
                                    "required": ["id", "motivo"],
                                    "additionalProperties": False,
                                },
                            }
                        },
                        "required": ["sugerencias"],
                        "additionalProperties": False,
                    },
                },
            },
        )
        elegidas = json.loads(response.choices[0].message.content)["sugerencias"]
        por_id = {i["id"]: i for i in candidatos}
        salida = [_con_url(por_id[e["id"]], e["motivo"]) for e in elegidas if e["id"] in por_id]
        if salida:
            return salida[:MAX_SUGERENCIAS]
    except Exception:
        pass
    return _respaldo(candidatos, prendas)
