from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import (
    User, Goal, Constraint, Decision, Feedback, Document, DocumentChunk, Action,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/{user_id}")
def get_dashboard(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    goals = db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.id).all()
    constraints = (
        db.query(Constraint)
        .filter(Constraint.user_id == user_id, Constraint.active.is_(True))
        .order_by(Constraint.id)
        .all()
    )
    decisions = db.query(Decision).filter(Decision.user_id == user_id).order_by(Decision.id.desc()).all()
    documents = db.query(Document).filter(Document.user_id == user_id).order_by(Document.id.desc()).all()

    decision_ids = [d.id for d in decisions]
    latest_feedback = {}
    actions_by_decision = {}
    if decision_ids:
        for f in db.query(Feedback).filter(Feedback.decision_id.in_(decision_ids)).order_by(Feedback.id).all():
            latest_feedback[f.decision_id] = f  # later rows overwrite earlier ones
        for a in db.query(Action).filter(Action.decision_id.in_(decision_ids)).order_by(Action.id).all():
            actions_by_decision.setdefault(a.decision_id, []).append(
                {"id": a.id, "description": a.description, "status": a.status}
            )

    all_actions = [a for lst in actions_by_decision.values() for a in lst]

    chunk_counts = dict(
        db.query(DocumentChunk.document_id, func.count(DocumentChunk.id))
        .filter(DocumentChunk.user_id == user_id)
        .group_by(DocumentChunk.document_id)
        .all()
    )

    return {
        "user": {"id": user.id, "name": user.name},
        "stats": {
            "goals": sum(1 for g in goals if g.status == "active"),
            "constraints": len(constraints),
            "decisions": len(decisions),
            "documents": len(documents),
            "tasks_total": len(all_actions),
            "tasks_done": sum(1 for a in all_actions if a["status"] == "done"),
        },
        "goals": [
            {"id": g.id, "title": g.title, "description": g.description, "status": g.status}
            for g in goals
        ],
        "constraints": [
            {"id": c.id, "description": c.description, "type": c.type}
            for c in constraints
        ],
        "decisions": [
            {
                "id": d.id,
                "question": d.question,
                "chosen_option": d.chosen_option,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "actions": actions_by_decision.get(d.id, []),
                "outcome": (
                    {
                        "text": latest_feedback[d.id].outcome,
                        "worked": latest_feedback[d.id].worked_as_expected,
                    }
                    if d.id in latest_feedback else None
                ),
            }
            for d in decisions
        ],
        "documents": [
            {"id": x.id, "title": x.title, "chunks": chunk_counts.get(x.id, 0)}
            for x in documents
        ],
    }