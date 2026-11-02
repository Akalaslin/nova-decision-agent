import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Decision, Action
from app.services.llm import generate
from app.services.memory import save_memory

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanFromAnswer(BaseModel):
    user_id: int
    question: str
    answer: str


class ActionUpdate(BaseModel):
    status: str  # todo, in_progress or done


EXTRACT_PROMPT = """You turn an assistant's answer into a short action plan.
Return ONLY valid JSON, with no markdown fences and no extra text, in exactly this shape:
{"title": "<short title, max 12 words>", "steps": ["<step 1>", "<step 2>"]}
Rules:
- 3 to 8 steps.
- Each step is one concrete action, starting with a verb, max 20 words.
- Use only actions that appear in the answer. Do not invent new ones.
- Keep the user's own wording and numbers where possible."""


def parse_plan(text: str):
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON found")
    data = json.loads(text[start:end + 1])
    title = str(data.get("title", "")).strip() or "Action plan"
    steps = [str(s).strip() for s in data.get("steps", []) if str(s).strip()]
    if not steps:
        raise ValueError("No steps found")
    return title, steps[:8]


@router.post("/from-answer")
def plan_from_answer(body: PlanFromAnswer, db: Session = Depends(get_db)):
    answer = body.answer.strip()
    if len(answer) < 40:
        raise HTTPException(status_code=400, detail="That answer is too short to make a plan from.")

    try:
        raw = generate(
            EXTRACT_PROMPT,
            f"QUESTION:\n{body.question}\n\nANSWER:\n{answer[:6000]}",
            use_tools=False,
        ) or ""
        title, steps = parse_plan(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail="Couldn't read a plan from that answer. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    decision = Decision(
        user_id=body.user_id,
        question=body.question[:500],
        reasoning=answer[:2000],
        chosen_option=title,
        status="acted",
    )
    db.add(decision)
    db.flush()
    actions = [Action(decision_id=decision.id, description=s) for s in steps]
    db.add_all(actions)
    db.commit()

    # remember the plan so future questions can find it
    summary = f"Decision: {body.question}\nPlan chosen: {title}\nSteps: " + "; ".join(steps)
    try:
        save_memory(db, body.user_id, "decisions", decision.id, summary)
    except Exception as e:
        print("MEMORY ERROR (plan):", repr(e))

    return {
        "decision_id": decision.id,
        "title": title,
        "actions": [{"id": a.id, "description": a.description, "status": a.status} for a in actions],
    }


@router.patch("/actions/{action_id}")
def update_action(action_id: int, body: ActionUpdate, db: Session = Depends(get_db)):
    if body.status not in ("todo", "in_progress", "done"):
        raise HTTPException(status_code=400, detail="status must be todo, in_progress or done")

    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    action.status = body.status

    decision = db.query(Decision).filter(Decision.id == action.decision_id).first()
    siblings = db.query(Action).filter(Action.decision_id == action.decision_id).all()
    if decision:
        if all(a.status == "done" for a in siblings):
            decision.status = "completed"
        elif decision.status == "completed":
            decision.status = "acted"

    db.commit()
    return {"id": action.id, "status": action.status, "decision_status": decision.status if decision else None}