from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.db.base import Base
from app.db.session import engine
from app.models import models as _models, cockpit as _cockpit_models  # noqa: F401 (registers the tables)
from app.core.demo import demo_guard
from app.core.usage import ensure_table
from app.routers import (
    users, goals, constraints, decisions, advisor,
    memory, documents, feedback, dashboard, plans, premortem, insights, profiles, usage, lab, cockpit,
)

app = FastAPI(title="NOVA - Personal Decision Intelligence Agent")

# creates any missing tables (also on a fresh demo database); existing data is never touched
try:
    Base.metadata.create_all(bind=engine)
    ensure_table()
except Exception as e:
    print("Could not prepare the tables:", repr(e))

# order matters: CORS is added last so it wraps everything, including the demo guard's replies
app.middleware("http")(demo_guard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Usage-Used", "X-Usage-Limit"],
)

app.include_router(users.router)
app.include_router(goals.router)
app.include_router(constraints.router)
app.include_router(decisions.router)
app.include_router(advisor.router)
app.include_router(memory.router)
app.include_router(documents.router)
app.include_router(feedback.router)
app.include_router(dashboard.router)
app.include_router(plans.router)
app.include_router(premortem.router)
app.include_router(insights.router)
app.include_router(profiles.router)
app.include_router(usage.router)
app.include_router(lab.router)
app.include_router(cockpit.router)

@app.get("/")
def root():
    return {"message": "NOVA backend is running"}

@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}