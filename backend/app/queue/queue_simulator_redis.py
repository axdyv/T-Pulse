"""
Redis Queue Simulator: Loads synthetic tweets and simulates real-time arrival
with timestamp compression for testing. Uses Redis for persistence and scaling.
"""
import json
import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import logging
import redis
from redis import Redis

logger = logging.getLogger(__name__)


class RedisQueueSimulator:
    """
    Manages synthetic tweet queue with time compression using Redis.
    
    Features:
    - Load tweets from JSON file
    - Compress timestamps for faster testing
    - Store queue in Redis (persistent, scalable)
    - Control feed rate (tweets/second)
    - Respect temporal ordering
    
    Redis Structure:
    - List key: "{queue_name}" - tweet queue
    - Metadata key: "{queue_name}:meta" - compression metadata
    """
    
    def __init__(
        self,
        json_path: str,
        replay_duration_seconds: int = 600,
        rate_limit: int = 50,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        redis_db: int = 0,
        queue_name: str = "tweet_queue",
    ):
        """
        Initialize Redis queue simulator.
        
        Args:
            json_path: Path to synthetic_tweets.json
            replay_duration_seconds: How long to replay the tweets (compression)
            rate_limit: Max tweets to add to queue per second
            redis_host: Redis server hostname
            redis_port: Redis server port
            redis_db: Redis database number
            queue_name: Name of the Redis list/key for the queue
        """
        self.json_path = Path(json_path)
        self.rate_limit = rate_limit
        self.replay_duration = replay_duration_seconds
        self.queue_name = queue_name
        self.tweets = []
        self.min_ts = None
        self.max_ts = None
        self.compression_ratio = None
        self.is_running = False
        self.start_time = None
        
        # Redis connection
        try:
            self.redis_client: Redis = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=redis_db,
                decode_responses=True,  # Return strings instead of bytes
                socket_connect_timeout=5,
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"Connected to Redis at {redis_host}:{redis_port}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
        
        # Clear any existing queue data on init
        self._clear_queue()
    
    def _clear_queue(self) -> None:
        """Clear Redis queue and metadata."""
        try:
            self.redis_client.delete(self.queue_name)
            self.redis_client.delete(f"{self.queue_name}:meta")
            logger.debug(f"Cleared Redis queue: {self.queue_name}")
        except Exception as e:
            logger.error(f"Error clearing Redis queue: {e}")
    
    def load_tweets(self) -> bool:
        """Load tweets from JSON file."""
        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
                
            # Handle both list and dict with 'tweets' key
            if isinstance(raw_data, list):
                self.tweets = raw_data
            elif isinstance(raw_data, dict) and 'tweets' in raw_data:
                self.tweets = raw_data.get('tweets', [])
            else:
                self.tweets = []
            
            if not self.tweets:
                logger.error("No tweets found in JSON file")
                return False
            
            # Normalize tweets to expected format
            for tweet in self.tweets:
                # Extract lat/lon from nested location or direct fields
                if 'location' in tweet and isinstance(tweet['location'], dict):
                    tweet['latitude'] = tweet['location'].get('latitude', tweet.get('latitude'))
                    tweet['longitude'] = tweet['location'].get('longitude', tweet.get('longitude'))
            
            # Extract timestamps
            timestamps = []
            for tweet in self.tweets:
                if 'timestamp' in tweet:
                    # Parse timestamp string if needed
                    ts_str = tweet['timestamp']
                    if isinstance(ts_str, str):
                        try:
                            ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00')).timestamp()
                        except:
                            # Fallback: assume Unix timestamp
                            ts = float(ts_str)
                    else:
                        ts = float(ts_str)
                    timestamps.append(ts)
                    tweet['_parsed_timestamp'] = ts
            
            if timestamps:
                self.min_ts = min(timestamps)
                self.max_ts = max(timestamps)
                original_duration = self.max_ts - self.min_ts
                
                if original_duration > 0:
                    self.compression_ratio = original_duration / self.replay_duration
                else:
                    self.compression_ratio = 1.0
                    
                logger.info(
                    f"Loaded {len(self.tweets)} tweets. "
                    f"Original span: {original_duration}s, "
                    f"Replay duration: {self.replay_duration}s, "
                    f"Compression ratio: {self.compression_ratio:.2f}x"
                )
            else:
                logger.warning("No timestamps found in tweets, using as-is")
                self.compression_ratio = 1.0
                
            return True
        except Exception as e:
            logger.error(f"Failed to load tweets: {e}")
            return False
    
    def _get_compressed_delay(self, current_tweet, prev_tweet) -> float:
        """
        Calculate delay before adding this tweet based on compressed timestamps.
        
        Args:
            current_tweet: Current tweet object
            prev_tweet: Previous tweet object
            
        Returns:
            Delay in seconds before adding this tweet
        """
        if prev_tweet is None:
            return 0.0
            
        current_ts = current_tweet.get('_parsed_timestamp', 0)
        prev_ts = prev_tweet.get('_parsed_timestamp', 0)
        
        original_delay = current_ts - prev_ts
        compressed_delay = original_delay / self.compression_ratio if self.compression_ratio else 0
        return max(0, compressed_delay)
    
    async def feed_queue(self) -> None:
        """
        Main loop: feed tweets to Redis queue with time delays.
        Respects compression ratio and rate limiting.
        """
        if not self.tweets:
            logger.error("No tweets loaded. Call load_tweets() first.")
            return
        
        # Sort by timestamp to ensure ordering
        sorted_tweets = sorted(
            self.tweets,
            key=lambda t: t.get('_parsed_timestamp', 0)
        )
        
        self.is_running = True
        self.start_time = time.time()
        
        logger.info(f"Starting queue feed loop for {len(sorted_tweets)} tweets to Redis")
        
        try:
            for idx, tweet in enumerate(sorted_tweets):
                if not self.is_running:
                    break
                
                # Calculate delay (pass current and previous tweet)
                prev_tweet = sorted_tweets[idx - 1] if idx > 0 else None
                delay = self._get_compressed_delay(tweet, prev_tweet)
                
                if delay > 0:
                    await asyncio.sleep(delay)
                
                # Prepare tweet for queue
                queued_item = {
                    'tweet_id': tweet.get('id', f'syn_{idx}'),
                    'text': tweet.get('text', ''),
                    'lat': tweet.get('latitude'),
                    'lon': tweet.get('longitude'),
                    'timestamp': tweet.get('_parsed_timestamp', time.time()),
                    'added_to_queue_time': time.time(),
                    'source': 'synthetic',
                    'meta_json': {
                        'original_timestamp': tweet.get('timestamp'),
                        'location': tweet.get('location', {}),
                        **{k: v for k, v in tweet.items() if k not in 
                           ['id', 'text', 'latitude', 'longitude', 'timestamp', '_parsed_timestamp', 'location']}
                    }
                }
                
                # Push to Redis list (RPUSH - right push, adds to tail)
                try:
                    self.redis_client.rpush(self.queue_name, json.dumps(queued_item))
                except Exception as e:
                    logger.error(f"Error pushing to Redis queue: {e}")
                
                if idx % 100 == 0:
                    logger.debug(f"Queued {idx}/{len(sorted_tweets)} tweets")
                    
        except asyncio.CancelledError:
            logger.info("Queue feed loop cancelled")
            self.is_running = False
        except Exception as e:
            logger.error(f"Error in queue feed loop: {e}", exc_info=True)
            self.is_running = False
    
    def get_next(self) -> Optional[Dict[str, Any]]:
        """
        Get next tweet from Redis queue (non-blocking).
        
        Returns:
            Tweet dict or None if queue is empty
        """
        try:
            # LPOP - left pop, removes from head
            item_json = self.redis_client.lpop(self.queue_name)
            if item_json:
                return json.loads(item_json)
            return None
        except Exception as e:
            logger.error(f"Error getting from Redis queue: {e}")
            return None
    
    def queue_size(self) -> int:
        """Get current queue size in Redis."""
        try:
            return self.redis_client.llen(self.queue_name)
        except Exception as e:
            logger.error(f"Error getting queue size: {e}")
            return 0
    
    def stop(self) -> None:
        """Stop the queue feeder and clean up."""
        self.is_running = False
        try:
            self._clear_queue()
            logger.info("Queue simulator stopped and Redis queue cleared")
        except Exception as e:
            logger.error(f"Error stopping queue simulator: {e}")
