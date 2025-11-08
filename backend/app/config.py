from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    port: int = int(os.getenv("PORT", 8000))
    db_url: str = (
        f"postgresql+psycopg://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
        f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    reddit_client_id: str = os.getenv("REDDIT_CLIENT_ID", "")
    reddit_client_secret: str = os.getenv("REDDIT_CLIENT_SECRET", "")
    reddit_user_agent: str = os.getenv("REDDIT_USER_AGENT", "tmobile/0.1")
    gp_app_id: str = os.getenv("GP_APP_ID", "com.tmobile.pr.mytmobile")

settings = Settings()
