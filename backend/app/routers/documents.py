from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.services.documents import extract_text, ingest_document, search_documents

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_BYTES = 5_000_000  # 5 MB

@router.post("/upload")
def upload_document(user_id: int = Form(...), file: UploadFile = File(...),
                    db: Session = Depends(get_db)):
    data = file.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")
    try:
        text = extract_text(file.filename, data)
        doc, n = ingest_document(db, user_id, file.filename, text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("INGEST ERROR:", repr(e))
        raise HTTPException(status_code=502, detail=f"Ingestion failed: {e}")
    return {"document_id": doc.id, "title": doc.title, "chunks": n}

@router.get("/search")
def documents_search(user_id: int, q: str, k: int = 4, db: Session = Depends(get_db)):
    return search_documents(db, user_id, q, k)