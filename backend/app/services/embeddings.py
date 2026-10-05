import math
import time
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from app.core.config import settings

def _normalize(vec):
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]

def embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT",
                retries: int = 3, batch_size: int = 50) -> list[list[float]]:
    client = genai.Client(api_key=settings.gemini_api_key)
    out = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        for attempt in range(retries):
            try:
                resp = client.models.embed_content(
                    model=settings.embedding_model,
                    contents=batch,
                    config=types.EmbedContentConfig(
                        task_type=task_type,
                        output_dimensionality=settings.embedding_dim,
                    ),
                )
                break
            except ServerError:
                if attempt == retries - 1:
                    raise
                time.sleep(2 * (attempt + 1))
        out.extend(_normalize(e.values) for e in resp.embeddings)
    return out

def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    return embed_texts([text], task_type)[0]