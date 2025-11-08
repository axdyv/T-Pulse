from sqlalchemy import BigInteger, String, Float, JSON, text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from .db import Base

class EventRaw(Base):
    __tablename__ = "events_raw"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(server_default=text("CURRENT_TIMESTAMP"))
    source: Mapped[str] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(String(4000))
    lat: Mapped[float | None]
    lon: Mapped[float | None]
    region: Mapped[str | None] = mapped_column(String(16))
    meta_json: Mapped[dict | None] = mapped_column(JSON)

class NlpScored(Base):
    __tablename__ = "nlp_scored"
    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    anger: Mapped[float]
    joy: Mapped[float]
    trust: Mapped[float]
    surprise: Mapped[float]
    topics: Mapped[list[str] | None] = mapped_column(JSON)
