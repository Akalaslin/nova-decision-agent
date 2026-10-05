from mcp.server.mcpserver import MCPServer
from app.db.session import SessionLocal
from app.services.memory import search_memory
from app.models.models import Goal, Constraint

mcp = MCPServer("nova-decision-memory")

@mcp.tool()
def search_decision_memory(user_id: int, query: str) -> str:
    """Search NOVA's decision memory for past decisions and feedback relevant to a query."""
    db = SessionLocal()
    try:
        results = search_memory(db, user_id, query, k=5)
        if not results:
            return "No relevant memories found."
        return "\n\n".join(
            f"[{r['source_table']} #{r['source_id']}] (distance {r['distance']})\n{r['summary_text']}"
            for r in results
        )
    finally:
        db.close()

@mcp.tool()
def get_active_context(user_id: int) -> str:
    """Get a user's active goals and constraints."""
    db = SessionLocal()
    try:
        goals = db.query(Goal).filter(Goal.user_id == user_id, Goal.status == "active").all()
        constraints = db.query(Constraint).filter(Constraint.user_id == user_id, Constraint.active.is_(True)).all()
        goals_text = "\n".join(f"- {g.title}: {g.description or ''}" for g in goals) or "None"
        constraints_text = "\n".join(f"- ({c.type}) {c.description}" for c in constraints) or "None"
        return f"GOALS:\n{goals_text}\n\nCONSTRAINTS:\n{constraints_text}"
    finally:
        db.close()

if __name__ == "__main__":
    mcp.run()