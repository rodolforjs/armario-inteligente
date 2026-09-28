import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "armario.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS zona (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    led_id TEXT
);

CREATE TABLE IF NOT EXISTS prenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    foto_path TEXT NOT NULL,
    tipo TEXT NOT NULL,
    color TEXT NOT NULL,
    formalidad TEXT NOT NULL,
    abrigo TEXT NOT NULL,
    tag_uid TEXT UNIQUE,
    zona_actual TEXT,
    estado TEXT NOT NULL DEFAULT 'disponible',
    veces_usada INTEGER NOT NULL DEFAULT 0,
    fecha_ultimo_uso TEXT,
    creado_en TEXT NOT NULL,
    FOREIGN KEY (zona_actual) REFERENCES zona(id)
);

CREATE TABLE IF NOT EXISTS sesion_recomendacion (
    id TEXT PRIMARY KEY,
    ocasion TEXT,
    texto_libre TEXT,
    modo TEXT NOT NULL,
    clima_json TEXT,
    conjuntos_json TEXT,
    rechazos_count INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'en_curso',
    creado_en TEXT NOT NULL,
    confirmada_en TEXT
);

CREATE TABLE IF NOT EXISTS evento_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    tipo TEXT NOT NULL,
    sesion_id TEXT,
    prenda_id INTEGER,
    payload_json TEXT
);
"""

DEFAULT_ZONAS = [
    ("zona_1", "Colgador superior", "led_1"),
    ("zona_2", "Colgador inferior", "led_2"),
    ("zona_3", "Cajón", "led_3"),
]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db_session() as conn:
        conn.executescript(SCHEMA)
        existing = conn.execute("SELECT COUNT(*) AS c FROM zona").fetchone()["c"]
        if existing == 0:
            conn.executemany(
                "INSERT INTO zona (id, nombre, led_id) VALUES (?, ?, ?)",
                DEFAULT_ZONAS,
            )
