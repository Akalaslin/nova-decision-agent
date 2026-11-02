from typing import TypedDict, Optional

class AgentState(TypedDict):
    user_id: int
    question: str
    history: list[dict]
    search_query: str
    goals_text: str
    constraints_text: str
    memories: list[dict]
    docs: list[dict]
    answer: Optional[str]
    _has_docs: bool
    _is_smalltalk: bool