from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Action, Feedback, Decision
from app.schemas.schemas import ActionCreate, ActionOut, FeedbackCreate, FeedbackOut
from app.services.memory import save_memory

router = APIRouter(tags=["feedback"])

@router.post("/actions", response_model=ActionOut)
def create_action(a: ActionCreate, db: Session = Depends(get_db)):
    new_a = Action(decision_id=a.decision_id, description=a.description)
    db.add(new_a)
    db.commit()
    db.refresh(new_a)
    return new_a

@router.get("/actions", response_model=list[ActionOut])
def list_actions(decision_id: int, db: Session = Depends(get_db)):
    return db.query(Action).filter(Action.decision_id == decision_id).all()


@router.post("/feedback", response_model=FeedbackOut)
def create_feedback(f: FeedbackCreate, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == f.decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    new_f = Feedback(decision_id=f.decision_id, outcome=f.outcome, worked_as_expected=f.worked_as_expected)
    db.add(new_f)

    decision.status = "completed"

    summary = (
        f"Outcome of decision: {decision.question}\n"
        f"Chosen: {decision.chosen_option or 'n/a'}\n"
        f"Result: {f.outcome}\n"
        f"Worked as expected: {f.worked_as_expected}"
    )
    try:
        save_memory(db, decision.user_id, "feedback", decision.id, summary)
    except Exception as e:
        print("MEMORY ERROR (feedback):", repr(e))

    db.commit()
    db.refresh(new_f)
    return new_f