from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    name: str

class UserOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class GoalCreate(BaseModel):
    user_id: int
    title: str
    description: Optional[str] = None

class GoalOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    status: str

    class Config:
        from_attributes = True


class ConstraintCreate(BaseModel):
    user_id: int
    goal_id: Optional[int] = None
    description: str
    type: Optional[str] = None

class ConstraintOut(BaseModel):
    id: int
    user_id: int
    goal_id: Optional[int]
    description: str
    type: Optional[str]
    active: bool

    class Config:
        from_attributes = True


class DecisionCreate(BaseModel):
    user_id: int
    goal_id: Optional[int] = None
    question: str
    reasoning: Optional[str] = None
    chosen_option: Optional[str] = None

class DecisionOut(BaseModel):
    id: int
    user_id: int
    goal_id: Optional[int]
    question: str
    reasoning: Optional[str]
    chosen_option: Optional[str]
    status: str

    class Config:
        from_attributes = True        

class AdviceRequest(BaseModel):
    user_id: int
    question: str

class AdviceOut(BaseModel):
    answer: str
    memories_used: list[dict] = []
    documents_used: list[dict] = []
class ActionCreate(BaseModel):
    decision_id: int
    description: str
    due_date: Optional[str] = None

class ActionOut(BaseModel):
    id: int
    decision_id: int
    description: str
    status: str

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    decision_id: int
    outcome: str
    worked_as_expected: Optional[bool] = None

class FeedbackOut(BaseModel):
    id: int
    decision_id: int
    outcome: str
    worked_as_expected: Optional[bool]

    class Config:
        from_attributes = True