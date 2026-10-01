import os

from openai import OpenAI

MODEL = "gpt-4o-mini"

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ["OPENAI_API_KEY"]
        _client = OpenAI(api_key=api_key)
    return _client
