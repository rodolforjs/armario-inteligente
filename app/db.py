import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ["DATABASE_URL"]

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS zona (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        led_id TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS prenda (
        id SERIAL PRIMARY KEY,
        foto_path TEXT NOT NULL,
        tipo TEXT NOT NULL,
        color TEXT NOT NULL,
        formalidad TEXT NOT NULL,
        abrigo TEXT NOT NULL,
        tag_uid TEXT UNIQUE,
        zona_actual TEXT REFERENCES zona(id),
        estado TEXT NOT NULL DEFAULT 'disponible',
        veces_usada INTEGER NOT NULL DEFAULT 0,
        fecha_ultimo_uso TEXT,
        creado_en TEXT NOT NULL
    )
    """,
    "ALTER TABLE prenda ADD COLUMN IF NOT EXISTS marca TEXT",
    "ALTER TABLE prenda ADD COLUMN IF NOT EXISTS material TEXT",
    "ALTER TABLE prenda ADD COLUMN IF NOT EXISTS temporada TEXT",
    "ALTER TABLE sesion_recomendacion ADD COLUMN IF NOT EXISTS preferencias_json TEXT",
    "ALTER TABLE zona ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'colgador'",
    "UPDATE zona SET tipo = 'cajon' WHERE id = 'zona_3' AND nombre = 'Cajón'",
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evento_log (
        id SERIAL PRIMARY KEY,
        timestamp TEXT NOT NULL,
        tipo TEXT NOT NULL,
        sesion_id TEXT,
        prenda_id INTEGER,
        payload_json TEXT
    )
    """,
]

DEFAULT_ZONAS = [
    ("zona_1", "Colgador superior", "led_1", "colgador"),
    ("zona_2", "Colgador inferior", "led_2", "colgador"),
    ("zona_3", "Cajón", "led_3", "cajon"),
]


class Conn:
    """Pequeño wrapper para poder reusar el mismo estilo sqlite3 (placeholders '?', filas tipo dict) sobre psycopg."""

    def __init__(self, pg_conn: psycopg.Connection):
        self._conn = pg_conn

    def execute(self, query: str, params=()):
        cur = self._conn.cursor()
        cur.execute(query.replace("?", "%s"), params)
        return cur

    def executemany(self, query: str, seq_of_params):
        cur = self._conn.cursor()
        cur.executemany(query.replace("?", "%s"), seq_of_params)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_connection() -> Conn:
    pg_conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=False)
    return Conn(pg_conn)


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
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        existing = conn.execute("SELECT COUNT(*) AS c FROM zona").fetchone()["c"]
        if existing == 0:
            conn.executemany(
                "INSERT INTO zona (id, nombre, led_id, tipo) VALUES (?, ?, ?, ?)",
                DEFAULT_ZONAS,
            )
