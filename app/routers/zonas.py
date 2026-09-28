from fastapi import APIRouter

from app.db import db_session

router = APIRouter(prefix="/zonas", tags=["zonas"])


@router.get("")
def listar_zonas():
    with db_session() as conn:
        filas = conn.execute("SELECT * FROM zona").fetchall()
    return [dict(f) for f in filas]
