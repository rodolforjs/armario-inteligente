from __future__ import annotations

import json
from datetime import datetime, timezone


def registrar_evento(conn, tipo: str, sesion_id: str | None = None, prenda_id: int | None = None, payload: dict | None = None):
    conn.execute(
        "INSERT INTO evento_log (timestamp, tipo, sesion_id, prenda_id, payload_json) VALUES (?, ?, ?, ?, ?)",
        (
            datetime.now(timezone.utc).isoformat(),
            tipo,
            sesion_id,
            prenda_id,
            json.dumps(payload or {}, ensure_ascii=False),
        ),
    )
