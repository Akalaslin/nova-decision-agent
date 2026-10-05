from google.genai import types

CALCULATOR_DECLARATION = types.FunctionDeclaration(
    name="calculator",
    description="Evaluate a basic arithmetic expression. Use this for any numeric comparison, e.g. salary math.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"expression": types.Schema(type="STRING", description="e.g. '900000 / 12'")},
        required=["expression"],
    ),
)

WEB_SEARCH_DECLARATION = types.FunctionDeclaration(
    name="web_search",
    description="Search the web for current, real-world information NOVA does not already know.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"query": types.Schema(type="STRING", description="Search query")},
        required=["query"],
    ),
)

TOOLS = types.Tool(function_declarations=[CALCULATOR_DECLARATION, WEB_SEARCH_DECLARATION])