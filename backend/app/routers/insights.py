from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.models.models import Decision, Feedback, Action
from app.services.llm import generate

router = APIRouter(prefix="/insights", tags=["insights"])

MIN_OUTCOMES = 3

SYSTEM_PROMPT = """You are NOVA looking for patterns in a person's own decision history.
You are given decisions that have a recorded outcome. For each you get: the question, what the person chose, their reasoning, what happened, whether it worked as expected, and how many plan tasks were completed.

Write a short pattern summary:
1. Up to 3 patterns. A pattern must be supported by at least 2 of the decisions given. Name the decisions briefly (a few words each) and say how they turned out.
2. If the data does not support a clear pattern, say "I don't see a clear pattern yet." and explain in one sentence why. Do not stretch the data.
3. End with one small, practical suggestion for the next decision, based only on these patterns.

Rules:
- Use only the decisions given. Never invent decisions, outcomes or numbers.
- Treat unclear or very short outcome text as weak evidence.
- Keep it under 150 words, in plain language, with short bullet points."""


@router.post("/{user_id}")
def get_insights(user_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Decision, Feedback)
        .join(Feedback, Feedback.decision_id == Decision.id)
        .filter(Decision.user_id == user_id)
        .order_by(Feedback.id)
        .all()
    )
    latest = {}
    for d, f in rows:
        latest[d.id] = (d, f)  # the latest outcome of each decision wins

    # only outcomes written in a real sentence count as evidence
    usable = [(d, f) for d, f in latest.values() if len(f.outcome.split()) >= 4]
    if len(usable) < MIN_OUTCOMES:
        raise HTTPException(
            status_code=400,
            detail=f"Record at least {MIN_OUTCOMES} outcomes written in full sentences first. You have {len(usable)}.",
        )

    ids = [d.id for d, _ in usable]
    tasks = {}
    for a in db.query(Action).filter(Action.decision_id.in_(ids)).all():
        done, total = tasks.get(a.decision_id, (0, 0))
        tasks[a.decision_id] = (done + (1 if a.status == "done" else 0), total + 1)

    def verdict(f):
        return "yes" if f.worked_as_expected is True else "no" if f.worked_as_expected is False else "unknown"

    lines = []
    for d, f in usable:
        done, total = tasks.get(d.id, (0, 0))
        lines.append(
            f"- Decision: {d.question} | Chose: {d.chosen_option or 'n/a'} | "
            f"Reasoning: {(d.reasoning or 'n/a')[:200]} | Outcome: {f.outcome} | "
            f"Worked as expected: {verdict(f)} | Plan tasks done: {done}/{total}"
        )

    prompt = "DECISIONS WITH A RECORDED OUTCOME:\n" + "\n".join(lines)

    try:
        ai_answer = generate(SYSTEM_PROMPT, prompt, use_tools=False)
    except Exception as e:
        print("LLM ERROR (insights):", repr(e))
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return {
        "answer": ai_answer + f"\n\nBased on {len(usable)} recorded outcomes.",
        "based_on": len(usable),
    }