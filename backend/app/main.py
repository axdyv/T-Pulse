from fastapi import FastAPI, Depends
from typing import List
from .routes import health
from .db import SessionLocal, engine
from .models import Base, EventRaw
from .schemas import EventOut
from sqlalchemy import select

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Magenta Pulse API", version="0.1.0")
app.include_router(health.router, prefix="/api")

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@app.get("/api/events/recent", response_model=List[EventOut])
def recent_events(limit: int = 20, db=Depends(get_db)):
    q = select(EventRaw).order_by(EventRaw.id.desc()).limit(limit)
    rows = db.execute(q).scalars().all()
    return rows
