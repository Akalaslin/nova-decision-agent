from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core import usage
from app.core.config import settings

router = APIRouter(tags=["usage"])


@router.get("/usage")
def get_usage(request: Request):
    if not settings.demo_mode:
        return {"enabled": False}
    visitor_key, ip_key = usage.client_keys(request)
    used, _, _ = usage.peek(visitor_key, ip_key)
    limit = usage.limits()[0]
    return JSONResponse(
        {"enabled": True, "used": used, "limit": limit},
        headers={"X-Usage-Used": str(used), "X-Usage-Limit": str(limit)},
    )