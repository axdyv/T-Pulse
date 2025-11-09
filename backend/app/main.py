import asyncio
import logging
import uuid
from pathlib import Path
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException
from typing import List
from .routes import health
from .db import SessionLocal, engine
from .models import Base, NlpScored
from .schemas import EventOut
from sqlalchemy import select
from .queue import RedisQueueSimulator, NLPProcessor, Aggregator
from .ws import manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="T-Pulse API", version="0.1.0")
app.include_router(health.router, prefix="/api")

# Global instances
queue_simulator: RedisQueueSimulator | None = None
nlp_processor: NLPProcessor | None = None
aggregator: Aggregator | None = None
background_tasks: List[asyncio.Task] = []
pipeline_running = False


def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()


@app.get("/api/events/recent", response_model=List[EventOut])
def recent_events(limit: int = 20, db=Depends(get_db)):
    q = select(NlpScored).order_by(NlpScored.id.desc()).limit(limit)
    rows = db.execute(q).scalars().all()
    return rows


async def broadcast_to_ws(tweets: List):
    """Callback for aggregator to broadcast to WebSocket clients."""
    await manager.broadcast_tweets(tweets)


async def initialize_pipeline():
    """Initialize the queue simulation pipeline."""
    global queue_simulator, nlp_processor, aggregator
    
    try:
        # Initialize components
        # Path from main.py: /code/app/main.py
        # We want: /code/app/ingest/synthetic_tweets.json
        json_path = Path(__file__).parent / "ingest" / "synthetic_tweets.json"
        logger.info(f"Loading tweets from: {json_path}")
        
        try:
            logger.info("Initializing RedisQueueSimulator...")
            queue_simulator = RedisQueueSimulator(
                json_path=str(json_path),
                replay_duration_seconds=60,  # 60 second replay
                rate_limit=50
            )
            logger.info("RedisQueueSimulator initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize RedisQueueSimulator: {e}", exc_info=True)
            raise
        
        try:
            logger.info("Initializing NLPProcessor...")
            nlp_processor = NLPProcessor(batch_size=32, flush_interval=20.0)
            logger.info("NLPProcessor initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize NLPProcessor: {e}", exc_info=True)
            raise
        
        try:
            logger.info("Initializing Aggregator...")
            aggregator = Aggregator(batch_size=20, ttl_seconds=90)
            aggregator.set_broadcast_callback(broadcast_to_ws)
            aggregator.set_db_session(SessionLocal())
            logger.info("Aggregator initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Aggregator: {e}", exc_info=True)
            raise
        
        logger.info("Pipeline initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error initializing pipeline: {e}", exc_info=True)
        return False


async def run_pipeline():
    """Run the queue simulation pipeline."""
    global queue_simulator, nlp_processor, aggregator, background_tasks, pipeline_running
    
    pipeline_running = True
    try:
        logger.info("Starting pipeline...")
        
        # Start queue feeder
        queue_task = asyncio.create_task(queue_simulator.feed_queue())
        background_tasks.append(queue_task)
        
        # Start NLP processor
        nlp_task = asyncio.create_task(nlp_processor.process_queue(queue_simulator))
        background_tasks.append(nlp_task)
        
        # Start aggregator
        agg_task = asyncio.create_task(aggregator.aggregate(nlp_processor))
        background_tasks.append(agg_task)
        
        # Start cleanup loop (delete expired records every 30 seconds)
        cleanup_task = asyncio.create_task(cleanup_loop())
        background_tasks.append(cleanup_task)
        
        logger.info("Pipeline tasks started")
        
        # Wait for tasks
        await asyncio.gather(*background_tasks, return_exceptions=True)
        
    except Exception as e:
        logger.error(f"Error in pipeline: {e}", exc_info=True)
    finally:
        pipeline_running = False


async def cleanup_loop():
    """Periodically clean up expired records."""
    while pipeline_running:
        try:
            await asyncio.sleep(10)  # Clean up every 10 seconds
            if aggregator:
                deleted = aggregator.cleanup_expired_records()
                if deleted > 0:
                    logger.debug(f"Cleaned up {deleted} expired records")
        except Exception as e:
            logger.error(f"Error in cleanup loop: {e}", exc_info=True)


@app.on_event("startup")
async def startup_event():
    """Initialize pipeline components on startup (but don't run yet)."""
    logger.info("T-Pulse backend started. Use POST /api/pipeline/start to begin processing")


@app.post("/api/pipeline/start")
async def start_pipeline():
    """Start the sentiment analysis pipeline."""
    global queue_simulator, nlp_processor, aggregator, pipeline_running
    
    if pipeline_running:
        raise HTTPException(status_code=400, detail="Pipeline is already running")
    
    try:
        logger.info("Attempting to start pipeline...")
        
        # Initialize if not already done
        if not queue_simulator:
            logger.info("Initializing pipeline components...")
            if not await initialize_pipeline():
                logger.error("Failed to initialize pipeline")
                raise HTTPException(status_code=500, detail="Failed to initialize pipeline")
        
        logger.info("Starting pipeline tasks...")
        # Start pipeline
        task = asyncio.create_task(run_pipeline())
        background_tasks.append(task)
        
        logger.info("Pipeline started successfully")
        return {
            "status": "started",
            "message": "Sentiment analysis pipeline started",
            "duration_seconds": 60  # Replay duration
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pipeline/stop")
async def stop_pipeline():
    """Stop the sentiment analysis pipeline."""
    global queue_simulator, nlp_processor, aggregator, background_tasks, pipeline_running
    
    if not pipeline_running:
        raise HTTPException(status_code=400, detail="Pipeline is not running")
    
    try:
        if queue_simulator:
            queue_simulator.stop()
        if nlp_processor:
            nlp_processor.stop()
        if aggregator:
            aggregator.stop()
        
        pipeline_running = False
        
        return {"status": "stopped", "message": "Pipeline stopped"}
    except Exception as e:
        logger.error(f"Error stopping pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    global queue_simulator, nlp_processor, aggregator, background_tasks
    
    if queue_simulator:
        queue_simulator.stop()
    if nlp_processor:
        nlp_processor.stop()
    if aggregator:
        aggregator.stop()
    
    # Cancel all background tasks
    for task in background_tasks:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    logger.info("Shutdown complete")


@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time tweet feed."""
    client_id = str(uuid.uuid4())
    await manager.connect(client_id, websocket)
    
    try:
        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            # Could handle commands from client here
            logger.debug(f"Received from {client_id}: {data}")
            
    except WebSocketDisconnect:
        await manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        await manager.disconnect(client_id)


@app.get("/api/stats/pipeline")
def get_pipeline_stats():
    """Get current pipeline stats."""
    return {
        "pipeline_running": pipeline_running,
        "active_connections": manager.get_connection_count(),
        "queue_size": queue_simulator.queue_size() if queue_simulator else 0,
        "components": {
            "queue_running": queue_simulator.is_running if queue_simulator else False,
            "nlp_running": nlp_processor.is_running if nlp_processor else False,
            "aggregator_running": aggregator.is_running if aggregator else False,
        }
    }
