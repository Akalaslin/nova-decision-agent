from fastapi import APIRouter
from app.core.config import settings
from app.core.profiles import get_profile, PROFILES

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/active")
def active_profile():
    p = get_profile()
    out = {k: v for k, v in p.items() if k != "guidance"}  # keep the internal instructions private
    out["demo_mode"] = settings.demo_mode
    return out


@router.get("/")
def list_profiles():
    return [{"id": k, "subtitle": v["subtitle"]} for k, v in PROFILES.items()]