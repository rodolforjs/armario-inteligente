import os
import uuid

from supabase import Client, create_client

BUCKET = "fotos-prendas"

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client


def subir_foto(contenido: bytes, content_type: str, extension: str) -> str:
    nombre_archivo = f"{uuid.uuid4().hex}{extension}"
    client = get_client()
    client.storage.from_(BUCKET).upload(
        nombre_archivo,
        contenido,
        {"content-type": content_type},
    )
    return client.storage.from_(BUCKET).get_public_url(nombre_archivo)


def borrar_foto(foto_url: str) -> None:
    nombre = foto_url.split("?")[0].rsplit("/", 1)[-1]
    get_client().storage.from_(BUCKET).remove([nombre])
