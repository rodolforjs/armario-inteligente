from __future__ import annotations

import json
import unicodedata
from datetime import datetime, timezone
from itertools import product

from app.services import clima as clima_service
from app.services.ai_client import MODEL, get_client

MODOS = {
    "exploratorio": 3,
    "pocas_opciones": 2,
    "preciso": 1,
}

SUPERIOR_KEYWORDS = ["camisa", "polera", "poleron", "chaqueta", "sweater", "blusa", "camiseta", "chomba"]
INFERIOR_KEYWORDS = ["pantalon", "falda", "short", "jean", "jeans", "bermuda"]
COMPLETO_KEYWORDS = ["vestido", "enterito", "jumpsuit", "mono"]

ABRIGO_POR_CLIMA = {
    "frio": ["abrigado", "medio"],
    "templado": ["medio", "liviano"],
    "calor": ["liviano"],
    "lluvia": ["abrigado", "medio"],
}


def _normalizar(texto: str) -> str:
    texto = texto.lower().strip()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def _categoria_prenda(tipo: str) -> str:
    tipo_norm = _normalizar(tipo)
    if any(k in tipo_norm for k in COMPLETO_KEYWORDS):
        return "completo"
    if any(k in tipo_norm for k in SUPERIOR_KEYWORDS):
        return "superior"
    if any(k in tipo_norm for k in INFERIOR_KEYWORDS):
        return "inferior"
    return "otro"


def _dias_desde_uso(fecha_ultimo_uso: str | None) -> int:
    if not fecha_ultimo_uso:
        return 999
    try:
        dt = datetime.fromisoformat(fecha_ultimo_uso)
    except ValueError:
        return 999
    return (datetime.now(timezone.utc) - dt).days


def _score_prenda(prenda: dict, clima_categoria: str, ocasion: str | None) -> float:
    score = 0.0
    if prenda["abrigo"] in ABRIGO_POR_CLIMA.get(clima_categoria, []):
        score += 2.0
    if ocasion and _normalizar(prenda["formalidad"]) == _normalizar(ocasion):
        score += 2.0
    score += min(_dias_desde_uso(prenda["fecha_ultimo_uso"]), 30) / 30.0
    score -= 0.3 * prenda["veces_usada"]
    return score


def _armar_conjuntos_candidatos(prendas: list[dict], clima_categoria: str, ocasion: str | None):
    superiores = [p for p in prendas if _categoria_prenda(p["tipo"]) == "superior"]
    inferiores = [p for p in prendas if _categoria_prenda(p["tipo"]) == "inferior"]
    completos = [p for p in prendas if _categoria_prenda(p["tipo"]) == "completo"]

    candidatos = []
    for sup, inf in product(superiores, inferiores):
        piezas = [sup, inf]
        score = sum(_score_prenda(p, clima_categoria, ocasion) for p in piezas)
        candidatos.append({"piezas": piezas, "score": score})
    for comp in completos:
        piezas = [comp]
        score = sum(_score_prenda(p, clima_categoria, ocasion) for p in piezas)
        candidatos.append({"piezas": piezas, "score": score})

    candidatos.sort(key=lambda c: c["score"], reverse=True)
    return candidatos


def _seleccionar_diversos(candidatos: list[dict], cantidad: int) -> list[dict]:
    seleccionados = []
    ids_usados = set()
    for candidato in candidatos:
        ids_piezas = {p["id"] for p in candidato["piezas"]}
        if ids_piezas & ids_usados:
            continue
        seleccionados.append(candidato)
        ids_usados |= ids_piezas
        if len(seleccionados) == cantidad:
            break
    if len(seleccionados) < cantidad:
        for candidato in candidatos:
            if candidato in seleccionados:
                continue
            seleccionados.append(candidato)
            if len(seleccionados) == cantidad:
                break
    return seleccionados


def _generar_razones(conjuntos: list[dict], clima: dict, ocasion: str | None, texto_libre: str | None) -> list[str]:
    if not conjuntos:
        return []
    resumen = []
    for idx, c in enumerate(conjuntos):
        piezas_desc = ", ".join(f"{p['tipo']} {p['color']} ({p['formalidad']}, abrigo {p['abrigo']})" for p in c["piezas"])
        resumen.append({"indice": idx, "piezas": piezas_desc})

    prompt = (
        "Eres el asistente de un armario inteligente. Con el clima actual de Santiago, "
        f"la ocasión declarada y el texto libre del usuario, escribe una razón breve (máximo 20 palabras, "
        "en español, tono cercano) para cada conjunto propuesto explicando por qué calza.\n\n"
        f"Clima: {json.dumps(clima, ensure_ascii=False)}\n"
        f"Ocasión: {ocasion or 'no especificada'}\n"
        f"Texto libre del usuario: {texto_libre or 'ninguno'}\n"
        f"Conjuntos: {json.dumps(resumen, ensure_ascii=False)}\n\n"
        "Responde solo con un JSON: lista de strings, una razón por conjunto, en el mismo orden."
    )

    fallback = [
        f"Combina bien con el clima ({clima['categoria']}) y tu rotación reciente de ropa."
        for _ in conjuntos
    ]
    try:
        client = get_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "razones_conjuntos",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {"razones": {"type": "array", "items": {"type": "string"}}},
                        "required": ["razones"],
                        "additionalProperties": False,
                    },
                },
            },
        )
        razones = json.loads(response.choices[0].message.content)["razones"]
        if isinstance(razones, list) and len(razones) == len(conjuntos):
            return razones
    except Exception:
        pass
    return fallback


def generar_recomendacion(prendas_disponibles: list[dict], ocasion: str | None, texto_libre: str | None, modo: str) -> dict:
    if modo not in MODOS:
        raise ValueError(f"Modo inválido: {modo}")
    cantidad = MODOS[modo]

    clima = clima_service.obtener_clima_actual()
    candidatos = _armar_conjuntos_candidatos(prendas_disponibles, clima["categoria"], ocasion)
    seleccionados = _seleccionar_diversos(candidatos, cantidad)
    razones = _generar_razones(seleccionados, clima, ocasion, texto_libre)

    conjuntos = []
    for c, razon in zip(seleccionados, razones):
        conjuntos.append(
            {
                "prenda_ids": [p["id"] for p in c["piezas"]],
                "piezas": [
                    {"id": p["id"], "tipo": p["tipo"], "color": p["color"], "foto_path": p["foto_path"]}
                    for p in c["piezas"]
                ],
                "score": round(c["score"], 2),
                "razon": razon,
            }
        )

    return {"clima": clima, "conjuntos": conjuntos}
