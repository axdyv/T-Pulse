"""
Aggregator: Batch processes tweets from NLP processor and saves to database.
Also broadcasts to connected WebSocket clients.
"""
import asyncio
import logging
from typing import Optional, Callable, Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class Aggregator:
    """
    Consumes processed tweets from NLP processor and:
    1. Saves to database (with TTL)
    2. Broadcasts to WebSocket clients
    """
    
    def __init__(self, batch_size: int = 20, ttl_seconds: int = 90):
        """
        Initialize aggregator.
        
        Args:
            batch_size: Number of tweets to batch before saving
            ttl_seconds: Time-to-live for records in seconds (default 90)
        """
        self.batch_size = batch_size
        self.ttl_seconds = ttl_seconds
        self.is_running = False
        self.ws_broadcast_callback: Optional[Callable] = None
        self.db_session: Optional[Session] = None
        
    def set_broadcast_callback(self, callback: Callable[[List[Dict[str, Any]]], None]) -> None:
        """
        Set callback for WebSocket broadcasting.
        
        Args:
            callback: Async function that takes list of tweets
        """
        self.ws_broadcast_callback = callback
    
    def set_db_session(self, db_session: Session) -> None:
        """Set database session."""
        self.db_session = db_session
    
    def _save_to_database(self, tweets: List[Dict[str, Any]]) -> None:
        """
        Save processed tweets to nlp_scored table with TTL.
        
        Stores: id, text, location, region, date, expires_at, sentiment_score
        """
        if not self.db_session:
            logger.warning("No DB session set, skipping save")
            return
        
        try:
            # Import models here to avoid circular imports
            from ..models import NlpScored
            
            now = datetime.now()
            expires_at = now + timedelta(seconds=self.ttl_seconds)
            
            for tweet in tweets:
                # Create NlpScored entry
                location = None
                if tweet.get('lat') is not None and tweet.get('lon') is not None:
                    location = {
                        "lat": tweet.get('lat'),
                        "lon": tweet.get('lon')
                    }
                
                nlp_score = NlpScored(
                    text=tweet.get('text', ''),
                    location=location,
                    region=self._estimate_region(tweet.get('lat'), tweet.get('lon')),
                    date=datetime.fromtimestamp(tweet.get('timestamp', datetime.now().timestamp())),
                    expires_at=expires_at,
                    sentiment_score=tweet.get('sentiment_score', 0.0),
                )
                self.db_session.add(nlp_score)
            
            self.db_session.commit()
            logger.info(f"Saved {len(tweets)} tweets to database (expires in {self.ttl_seconds} seconds)")
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}", exc_info=True)
            self.db_session.rollback()
    
    def cleanup_expired_records(self) -> int:
        """
        Delete expired records from database.
        
        Returns:
            Number of deleted records
        """
        if not self.db_session:
            logger.warning("No DB session set, skipping cleanup")
            return 0
        
        try:
            from ..models import NlpScored
            
            deleted = self.db_session.query(NlpScored).filter(
                NlpScored.expires_at < datetime.now()
            ).delete()
            self.db_session.commit()
            
            if deleted > 0:
                logger.info(f"Deleted {deleted} expired records")
            
            return deleted
            
        except Exception as e:
            logger.error(f"Error cleaning up expired records: {e}", exc_info=True)
            self.db_session.rollback()
            return 0
    
    def _estimate_region(self, lat: Optional[float], lon: Optional[float]) -> Optional[str]:
        """
        Simple region estimation from coordinates.
        
        In production, use geopy or similar for reverse geocoding.
        """
        if not lat or not lon:
            return None
        
        # Simple US regions based on coordinates
        if lat > 25 and lat < 49 and lon > -125 and lon < -65:
            if lon < -100:
                if lat > 40:
                    return "NORTHWEST"
                else:
                    return "SOUTHWEST"
            else:
                if lat > 40:
                    return "NORTHEAST"
                else:
                    return "SOUTHEAST"
        return None
    
    async def _broadcast_to_websockets(self, tweets: List[Dict[str, Any]]) -> None:
        """Broadcast tweets to all connected WebSocket clients."""
        if self.ws_broadcast_callback:
            try:
                if asyncio.iscoroutinefunction(self.ws_broadcast_callback):
                    await self.ws_broadcast_callback(tweets)
                else:
                    self.ws_broadcast_callback(tweets)
                logger.debug(f"Broadcasted {len(tweets)} tweets to WebSocket clients")
            except Exception as e:
                logger.error(f"Error broadcasting to WebSockets: {e}", exc_info=True)
    
    async def aggregate(self, nlp_processor) -> None:
        """
        Main loop: consume from NLP processor, batch, save, and broadcast.
        
        Args:
            nlp_processor: NLPProcessor instance
        """
        self.is_running = True
        batch = []
        
        logger.info("Aggregator started")
        
        try:
            while self.is_running:
                # Get batch from NLP processor
                processed_batch = await nlp_processor.get_batch()
                
                if processed_batch:
                    batch.extend(processed_batch)
                    logger.debug(f"Got batch of {len(processed_batch)} tweets, total: {len(batch)}")
                    
                    # If batch reaches size, save and broadcast
                    if len(batch) >= self.batch_size:
                        # Save to DB
                        self._save_to_database(batch[:self.batch_size])
                        
                        # Broadcast
                        await self._broadcast_to_websockets(batch[:self.batch_size])
                        
                        # Keep overflow for next batch
                        batch = batch[self.batch_size:]
                else:
                    # Small delay
                    await asyncio.sleep(0.5)
                    
                    # If batch has items but NLP queue is empty, flush
                    if batch:
                        self._save_to_database(batch)
                        await self._broadcast_to_websockets(batch)
                        batch = []
                        
        except asyncio.CancelledError:
            logger.info("Aggregator cancelled")
            # Flush remaining batch
            if batch:
                self._save_to_database(batch)
                await self._broadcast_to_websockets(batch)
            self.is_running = False
        except Exception as e:
            logger.error(f"Error in aggregator: {e}", exc_info=True)
            self.is_running = False
    
    def stop(self) -> None:
        """Stop the aggregator."""
        self.is_running = False
        logger.info("Aggregator stopped")
