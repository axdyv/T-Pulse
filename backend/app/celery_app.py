from backend.app.celery_app import Celery
from .config import settings

celery = Celery(
    "tmobile",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)
celery.conf.timezone = "UTC"
