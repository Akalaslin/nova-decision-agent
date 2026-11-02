from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


def today():
    return datetime.now(timezone.utc).date()


def ensure_table():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usage_counters (
                key text NOT NULL,
                day date NOT NULL,
                count integer NOT NULL DEFAULT 0,
                PRIMARY KEY (key, day)
            )
        """))


def client_keys(request: Request):
    vid = (request.headers.get("x-visitor-id") or "anon")[:64]
    vid = "".join(ch for ch in vid if ch.isalnum() or ch in "-_") or "anon"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"v:{vid}", f"ip:{ip[:64]}"


def limits():
    """(per visitor, per network address, whole demo) messages per day"""
    return settings.free_daily_limit, settings.free_daily_limit * 3, settings.demo_daily_ai_limit


def _count(conn, key, day):
    row = conn.execute(
        text("SELECT count FROM usage_counters WHERE key = :k AND day = :d"),
        {"k": key, "d": day},
    ).scalar()
    return row or 0


def peek(visitor_key, ip_key):
    day = today()
    with engine.connect() as conn:
        return _count(conn, visitor_key, day), _count(conn, ip_key, day), _count(conn, "global", day)


def bump(visitor_key, ip_key):
    day = today()
    with engine.begin() as conn:
        for key in (visitor_key, ip_key, "global"):
            conn.execute(
                text("""
                    INSERT INTO usage_counters (key, day, count) VALUES (:k, :d, 1)
                    ON CONFLICT (key, day) DO UPDATE SET count = usage_counters.count + 1
                """),
                {"k": key, "d": day},
            )