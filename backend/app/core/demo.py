from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.core import usage
from app.core.config import settings

# these paths use the AI; in demo mode they are allowed (they do not save anything)
AI_PATHS = ("/advisor/ask-graph", "/premortem", "/insights", "/lab", "/cockpit")
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _deny(status, message, headers=None):
    return JSONResponse(status_code=status, content={"detail": message}, headers=headers or {})


def _usage_headers(used, limit):
    return {"X-Usage-Used": str(used), "X-Usage-Limit": str(limit)}


async def demo_guard(request: Request, call_next):
    if not settings.demo_mode or request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path.rstrip("/") or "/"
    is_ai = path.startswith(AI_PATHS)

    # block every write except the AI endpoints
    if request.method in WRITE_METHODS and not is_ai:
        return _deny(403, "This is a read-only public demo. Run NOVA yourself to save your own data.")

    if is_ai and request.method == "POST":
        visitor_key, ip_key = usage.client_keys(request)
        try:
            v_used, ip_used, g_used = await run_in_threadpool(usage.peek, visitor_key, ip_key)
        except Exception as e:
            print("USAGE CHECK ERROR:", repr(e))
            return await call_next(request)  # never block visitors because the counter failed

        v_lim, ip_lim, g_lim = usage.limits()
        headers = _usage_headers(v_used, v_lim)

        if v_used >= v_lim:
            return _deny(429, f"You've reached today's free limit ({v_lim} messages). Pro is coming soon. Please come back tomorrow.", headers)
        if ip_used >= ip_lim:
            return _deny(429, "Too many requests from your network today (limit reached). Please come back tomorrow.", headers)
        if g_used >= g_lim:
            return _deny(429, "The demo has reached its daily AI limit. Please come back tomorrow.", headers)

        response = await call_next(request)

        # only a successful answer uses up a message
        if response.status_code < 400:
            try:
                await run_in_threadpool(usage.bump, visitor_key, ip_key)
                v_used += 1
            except Exception as e:
                print("USAGE COUNT ERROR:", repr(e))
        response.headers["X-Usage-Used"] = str(v_used)
        response.headers["X-Usage-Limit"] = str(v_lim)
        return response

    return await call_next(request)