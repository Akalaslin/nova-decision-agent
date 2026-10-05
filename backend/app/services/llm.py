import time
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from app.core.config import settings
from app.services.tool_schemas import TOOLS
from app.services.tools import calculator, web_search

AVAILABLE_FUNCTIONS = {"calculator": calculator, "web_search": web_search}

def _call_model(client, model, contents, system_instruction, use_tools):
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=[TOOLS] if use_tools else None,
    )
    return client.models.generate_content(model=model, contents=contents, config=config)

def generate(system_instruction: str, prompt: str, retries: int = 4, use_tools: bool = True) -> str:
    client = genai.Client(api_key=settings.gemini_api_key)
    models = [settings.gemini_model]
    if settings.gemini_fallback_model:
        models.append(settings.gemini_fallback_model)

    last_error = None
    for model in models:
        for attempt in range(retries):
            try:
                contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]

                for _ in range(5):  # max 5 tool round-trips to avoid infinite loops
                    response = _call_model(client, model, contents, system_instruction, use_tools)
                    part = response.candidates[0].content.parts[0]

                    if not getattr(part, "function_call", None):
                        return response.text

                    fn_call = part.function_call
                    fn = AVAILABLE_FUNCTIONS.get(fn_call.name)
                    result = fn(**fn_call.args) if fn else f"Unknown tool: {fn_call.name}"
                    print(f"Tool call: {fn_call.name}({dict(fn_call.args)}) -> {result}")

                    contents.append(response.candidates[0].content)
                    contents.append(types.Content(
                        role="user",
                        parts=[types.Part.from_function_response(name=fn_call.name, response={"result": result})],
                    ))
                return "Error: too many tool calls without a final answer."
            except ServerError as e:
                last_error = e
                print(f"Gemini busy on {model} (attempt {attempt + 1}/{retries})")
                if attempt < retries - 1:
                    time.sleep(3 * (attempt + 1))
    raise last_error