from app.db.base import Base
from app.db.session import engine
from app.models import models  # noqa: F401  (import so tables are registered)

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully.")

if __name__ == "__main__":
    init_db()