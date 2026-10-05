from sqlalchemy.orm import Session
from app.models.models import MemoryEmbedding
from app.services.embeddings import embed_text

def save_memory(db: Session, user_id: int, source_table: str, source_id: int, text: str):
    vec = embed_text(text, task_type="RETRIEVAL_DOCUMENT")
    db.add(MemoryEmbedding(
        user_id=user_id,
        source_table=source_table,
        source_id=source_id,
        summary_text=text,
        embedding=vec,
    ))
    db.commit()

def search_memory(db: Session, user_id: int, query: str, k: int = 3):
    qvec = embed_text(query, task_type="RETRIEVAL_QUERY")
    distance = MemoryEmbedding.embedding.cosine_distance(qvec).label("distance")
    rows = (
        db.query(MemoryEmbedding, distance)
        .filter(MemoryEmbedding.user_id == user_id)
        .order_by(distance)
        .limit(k)
        .all()
    )
    return [
        {
            "source_table": m.source_table,
            "source_id": m.source_id,
            "summary_text": m.summary_text,
            "distance": round(float(dist), 4),
        }
        for m, dist in rows
    ]