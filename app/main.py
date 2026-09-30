from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

load_dotenv()

from app.db import init_db
from app.routers import esp32, estado, prendas, recomendaciones, zonas

app = FastAPI(title="Armario Inteligente")

STATIC_DIR = Path(__file__).resolve().parent / "static"

init_db()

app.include_router(prendas.router)
app.include_router(zonas.router)
app.include_router(recomendaciones.router)
app.include_router(esp32.router)
app.include_router(estado.router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

# Uso: uvicorn app.main:app --host 0.0.0.0 --port $PORT (Render inyecta $PORT)
