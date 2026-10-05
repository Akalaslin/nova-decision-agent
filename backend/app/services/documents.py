import io
from sqlalchemy.orm import Session
from pypdf import PdfReader
from app.models.models import Document, DocumentChunk
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts, embed_text

def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".txt"):
        return data.decode("utf-8", errors="ignore")
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    raise ValueError("Only .txt and .pdf files are supported")

def ingest_document(db: Session, user_id: int, title: str, text: str):
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No readable text found in the document")
    vectors = embed_texts(chunks)          # embed first, so a failure leaves nothing half-saved
    doc = Document(user_id=user_id, title=title, raw_text=text)
    db.add(doc)
    db.flush()
    for i, (c, v) in enumerate(zip(chunks, vectors)):
        db.add(DocumentChunk(document_id=doc.id, user_id=user_id,
                             chunk_index=i, chunk_text=c, embedding=v))
    db.commit()
    return doc, len(chunks)

def search_documents(db: Session, user_id: int, query: str, k: int = 4):
    qvec = embed_text(query, task_type="RETRIEVAL_QUERY")
    distance = DocumentChunk.embedding.cosine_distance(qvec).label("distance")
    rows = (
        db.query(DocumentChunk, Document.title, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(DocumentChunk.user_id == user_id)
        .order_by(distance)
        .limit(k)
        .all()
    )
    return [
        {
            "document_id": c.document_id,
            "title": title,
            "chunk_index": c.chunk_index,
            "chunk_text": c.chunk_text,
            "distance": round(float(d), 4),
        }
        for c, title, d in rows
    ]