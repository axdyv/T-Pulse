from pydantic import BaseModel
from datetime import datetime

class EventIn(BaseModel):
    source: str
    text: str
    lat: float | None = None
    lon: float | None = None
    region: str | None = None
    meta_json: dict | None = None

class EventOut(EventIn):
    id: int
    ts: datetime
