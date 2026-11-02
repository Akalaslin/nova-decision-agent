from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class CockpitTopic(Base):
    __tablename__ = "cockpit_topics"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String, index=True, nullable=False)   # "u:2" for you, "v:<id>" for a demo visitor
    title = Column(String, nullable=False)
    decision_text = Column(Text, nullable=False)
    lean = Column(String, nullable=True)                 # Go, Go with changes or Wait
    verdict_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CockpitItem(Base):
    __tablename__ = "cockpit_items"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("cockpit_topics.id", ondelete="CASCADE"), nullable=False, index=True)
    statement = Column(Text, nullable=False)
    kind = Column(String, nullable=False, default="fact")      # fact or assumption
    why = Column(Text, nullable=True)
    confidence = Column(Integer, nullable=True)                 # 50 to 90, for assumptions
    status = Column(String, nullable=False, default="open")     # open, confirmed or refuted
    note = Column(Text, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=True)