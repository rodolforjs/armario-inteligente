import time

import httpx

SANTIAGO_LAT = -33.4489
SANTIAGO_LON = -70.6693
URL = "https://api.open-meteo.com/v1/forecast"

_cache = {"data": None, "ts": 0.0}
CACHE_TTL_SEGUNDOS = 30 * 60

DEFAULT_CLIMA = {
    "temperatura_c": None,
    "precipitacion_mm": 0.0,
    "viento_kmh": None,
    "categoria": "templado",
}


def _clasificar(temp_c: float, precipitacion: float, viento_kmh: float) -> str:
    if precipitacion > 0.5:
        return "lluvia"
    if temp_c <= 10:
        return "frio"
    if temp_c <= 18:
        return "templado"
    return "calor"


def obtener_clima_actual() -> dict:
    ahora = time.time()
    if _cache["data"] is not None and (ahora - _cache["ts"]) < CACHE_TTL_SEGUNDOS:
        return _cache["data"]

    params = {
        "latitude": SANTIAGO_LAT,
        "longitude": SANTIAGO_LON,
        "current": "temperature_2m,precipitation,wind_speed_10m",
        "timezone": "America/Santiago",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(URL, params=params)
            resp.raise_for_status()
            actual = resp.json()["current"]

        temp_c = actual["temperature_2m"]
        precipitacion = actual["precipitation"]
        viento_kmh = actual["wind_speed_10m"]

        data = {
            "temperatura_c": temp_c,
            "precipitacion_mm": precipitacion,
            "viento_kmh": viento_kmh,
            "categoria": _clasificar(temp_c, precipitacion, viento_kmh),
        }
        _cache["data"] = data
        _cache["ts"] = ahora
        return data
    except Exception:
        # Open-Meteo falló (ej. 429 por IP compartida en hosting gratis): usamos el
        # último clima conocido aunque esté vencido, o un valor neutro por defecto.
        return _cache["data"] or DEFAULT_CLIMA
