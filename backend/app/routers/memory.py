from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.services.memory import search_memory

router = APIRouter(prefix="/memory", tags=["memory"])

@router.get("/search")
def memory_search(user_id: int, q: str, k: int = 3, db: Session = Depends(get_db)):
    return search_memory(db, user_id, q, k)