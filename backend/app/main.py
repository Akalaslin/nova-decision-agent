from fastapi import FastAPI
from sqlalchemy import text
from app.db.session import engine
from app.routers import users, goals, constraints, decisions, advisor, memory, documents, feedback

app = FastAPI(title="NOVA - Personal Decision Intelligence Agent")

app.include_router(users.router)
app.include_router(goals.router)
app.include_router(constraints.router)
app.include_router(decisions.router)
app.include_router(advisor.router)
app.include_router(memory.router)
app.include_router(documents.router)
app.include_router(feedback.router)

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