from __future__ import annotations

_estado = {"zonas_encendidas": [], "motivo": ""}


def set_zonas(zonas: list[dict], motivo: str):
    """zonas: lista de {zona_id, led_id, tipo} a encender."""
    _estado["zonas_encendidas"] = zonas
    _estado["motivo"] = motivo


def apagar_todo():
    _estado["zonas_encendidas"] = []
    _estado["motivo"] = ""


def obtener_estado() -> dict:
    return dict(_estado)
