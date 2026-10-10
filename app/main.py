from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

from app.db import init_db
from app.routers import asistente, estado, prendas, recomendaciones, vision_closet, mercado

app = FastAPI(title="Armario Inteligente")

STATIC_DIR = Path(__file__).resolve().parent / "static"

init_db()

app.include_router(asistente.router)
app.include_router(prendas.router)
app.include_router(recomendaciones.router)
app.include_router(estado.router)
app.include_router(vision_closet.router)
app.include_router(mercado.router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/{ruta_completa:path}")
async def frontend(ruta_completa: str):
    # SPA: cualquier ruta que no sea API ni un archivo estático real (ej. /escaner,
    # que solo existe como ruteo del lado del cliente) sirve el index.html de React.
    candidato = STATIC_DIR / ruta_completa
    if ruta_completa and candidato.is_file():
        return FileResponse(candidato)
    return FileResponse(STATIC_DIR / "index.html")


# Uso: uvicorn app.main:app --host 0.0.0.0 --port $PORT (Render inyecta $PORT)
