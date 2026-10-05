from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Goal
from app.schemas.schemas import GoalCreate, GoalOut

router = APIRouter(prefix="/goals", tags=["goals"])

@router.post("/", response_model=GoalOut)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    new_goal = Goal(user_id=goal.user_id, title=goal.title, description=goal.description)
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return new_goal

@router.get("/", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db)):
    return db.query(Goal).all()