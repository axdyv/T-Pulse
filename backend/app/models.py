from sqlalchemy import BigInteger, String, Float, JSON, text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timedelta
from .db import Base

class EventRaw(Base):
    __tablename__ = "events_raw"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(default=datetime.now)
    source: Mapped[str] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(String(4000))
    lat: Mapped[float | None]
    lon: Mapped[float | None]
    region: Mapped[str | None] = mapped_column(String(16))
    meta_json: Mapped[dict | None] = mapped_column(JSON)

class NlpScored(Base):
    __tablename__ = "nlp_scored"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(String(4000))
    location: Mapped[dict | None] = mapped_column(JSON)  # {"lat": float, "lon": float}
    region: Mapped[str | None] = mapped_column(String(16))
    date: Mapped[datetime] = mapped_column(default=datetime.now)
    expires_at: Mapped[datetime]  # Auto-calculated on insert
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
