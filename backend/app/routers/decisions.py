from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Decision
from app.schemas.schemas import DecisionCreate, DecisionOut
from app.services.memory import save_memory

router = APIRouter(prefix="/decisions", tags=["decisions"])

@router.post("/", response_model=DecisionOut)
def create_decision(d: DecisionCreate, db: Session = Depends(get_db)):
    new_d = Decision(
        user_id=d.user_id,
        goal_id=d.goal_id,
        question=d.question,
        reasoning=d.reasoning,
        chosen_option=d.chosen_option,
    )
    db.add(new_d)
    db.commit()
    db.refresh(new_d)

    summary = (
        f"Decision: {d.question}\n"
        f"Reasoning: {d.reasoning or 'n/a'}\n"
        f"Chosen: {d.chosen_option or 'n/a'}"
    )
    try:
        save_memory(db, d.user_id, "decisions", new_d.id, summary)
    except Exception as e:
        print("MEMORY ERROR:", repr(e))   # the decision is still saved
    return new_d

@router.get("/", response_model=list[DecisionOut])
def list_decisions(db: Session = Depends(get_db)):
    return db.query(Decision).all()