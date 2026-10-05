from ddgs import DDGS

def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression like '900000 / 12' and return the result."""
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return "Error: expression contains disallowed characters."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"Error: {e}"

def web_search(query: str, max_results: int = 3) -> str:
    """Search the web and return a few short result snippets."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        if not results:
            return "No results found."
        return "\n\n".join(f"{r['title']}: {r['body']}" for r in results)
    except Exception as e:
        return f"Search error: {e}"