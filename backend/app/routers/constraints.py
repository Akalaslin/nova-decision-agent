from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Constraint
from app.schemas.schemas import ConstraintCreate, ConstraintOut

router = APIRouter(prefix="/constraints", tags=["constraints"])

@router.post("/", response_model=ConstraintOut)
def create_constraint(c: ConstraintCreate, db: Session = Depends(get_db)):
    new_c = Constraint(user_id=c.user_id, goal_id=c.goal_id, description=c.description, type=c.type)
    db.add(new_c)
    db.commit()
    db.refresh(new_c)
    return new_c

@router.get("/", response_model=list[ConstraintOut])
def list_constraints(db: Session = Depends(get_db)):
    return db.query(Constraint).all()