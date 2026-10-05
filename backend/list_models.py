from google import genai
from app.core.config import settings

client = genai.Client(api_key=settings.gemini_api_key)
for m in client.models.list():
    name = m.name.replace("models/", "")
    if "generateContent" in (m.supported_actions or []) and "flash" in name:
        print(name)