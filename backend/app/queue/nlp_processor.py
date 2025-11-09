"""
NLP Processor: Consumes tweets from Redis queue in batches and computes
sentiment using Google Cloud Natural Language API to calculate a happiness index.
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List
import time

# Google Cloud Natural Language
from google.cloud import language_v1
from google.cloud.language_v1 import types

logger = logging.getLogger(__name__)


class NLPProcessor:
    """
    Processes tweets with sentiment analysis using Google Cloud Natural Language API.
    
    Features:
    - Consumes tweets from Redis queue in batches
    - Uses Google Cloud Natural Language API for sentiment analysis
    - Computes happiness index from sentiment scores
    - Async batch processing with automatic flushing
    - Requires GOOGLE_APPLICATION_CREDENTIALS env var set
    """
    
    def __init__(
        self,
        batch_size: int = 16,
        flush_interval: float = 5.0,
    ):
        """
        Initialize NLP processor with Google Cloud Language API.
        
        Args:
            batch_size: Number of tweets to process before flushing
            flush_interval: Max seconds to wait before flushing partial batch
            
        Note:
            Requires GOOGLE_APPLICATION_CREDENTIALS environment variable
            pointing to service account JSON file.
        """
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        
        # Initialize Google Cloud Language client
        try:
            logger.info("Attempting to initialize Google Cloud Language API client...")
            self.client = language_v1.LanguageServiceClient()
            logger.info("Google Cloud Language API client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Cloud client: {e}", exc_info=True)
            logger.error(f"Make sure GOOGLE_APPLICATION_CREDENTIALS env var is set and points to valid credentials file")
            raise
        
        # Queue for processed results
        self.processed_queue = asyncio.Queue()
        self.is_running = False
        
        # Rate limiting: 600 requests per minute = 10 per second
        # Use a token bucket with slightly lower rate (0.09 req/sec = ~5.4 req/min) for headroom
        self.rate_limiter = asyncio.Semaphore(5)  # Max 5 concurrent
        self.min_request_interval = 0.1  # Minimum 100ms between requests
        self.last_request_time = 0
        
        logger.info(f"NLP Processor initialized (batch_size={batch_size}, max_concurrent=5, min_interval=100ms, using GCP)")

    
    def _compute_sentiment_score(self, sentiment_score: float) -> float:
        """
        Returns the sentiment score from Google Cloud API.
        
        Args:
            sentiment_score: Raw score from -1.0 (negative) to 1.0 (positive)
            
        Returns:
            Sentiment score clamped to [-1.0, 1.0]
        """
        return round(max(-1.0, min(1.0, sentiment_score)), 3)
    
    def process_tweet(self, tweet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process single tweet with Google Cloud Natural Language API sentiment analysis.
        
        Args:
            tweet: Raw tweet from Redis queue
            
        Returns:
            Tweet with added happiness_index field only
        """
        text = tweet.get("text", "")
        
        if not text:
            # Return tweet as-is if no text
            return {
                **tweet,
                "sentiment_score": 0.0,
            }
        
        try:
            # Create document for GCP Language API
            document = language_v1.Document(
                content=text,
                type_=types.Document.Type.PLAIN_TEXT,
            )
            
            # Call Google Cloud Natural Language API
            sentiment = self.client.analyze_sentiment(
                request={"document": document}
            )
            
            # Extract sentiment score
            sentiment_score = sentiment.document_sentiment.score  # -1.0 to 1.0
            
            # Compute sentiment score (with clamping)
            processed_sentiment = self._compute_sentiment_score(sentiment_score)
            
            # Enrich tweet
            processed_tweet = {
                **tweet,
                "sentiment_score": processed_sentiment,
            }
            
            return processed_tweet
            
        except Exception as e:
            logger.error(f"Error processing tweet {tweet.get('tweet_id')}: {e}")
            # Return tweet with neutral sentiment on error
            return {
                **tweet,
                "sentiment_score": 0.0,
                "error": str(e),
            }

    
    async def process_tweet_async(self, tweet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process single tweet asynchronously with rate limiting.
        
        Respects GCP API rate limits by:
        - Using a semaphore to cap concurrent requests to 5
        - Enforcing minimum 100ms interval between requests
        
        Args:
            tweet: Raw tweet from Redis queue
            
        Returns:
            Tweet with added sentiment_score field
        """
        async with self.rate_limiter:
            # Enforce minimum interval between requests
            elapsed = time.time() - self.last_request_time
            if elapsed < self.min_request_interval:
                await asyncio.sleep(self.min_request_interval - elapsed)
            
            self.last_request_time = time.time()
            
            # Run the blocking GCP call in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self.process_tweet, tweet)
    
    async def process_batch_concurrent(self, tweets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process multiple tweets concurrently with rate limiting.
        
        Args:
            tweets: List of tweets to process
            
        Returns:
            List of processed tweets
        """
        tasks = [self.process_tweet_async(tweet) for tweet in tweets]
        return await asyncio.gather(*tasks)

    
    async def process_queue(self, input_queue_simulator) -> None:
        """
        Consume tweets from Redis queue in batches and process concurrently.
        
        Strategy:
        1. Pre-fetch up to 50 tweets from queue (while available)
        2. Process them concurrently (max 10 at a time, respecting GCP limits)
        3. Batch results and emit when batch_size is reached
        4. Flush partial batches on timeout or queue empty
        
        Args:
            input_queue_simulator: RedisQueueSimulator or QueueSimulator instance
        """
        self.is_running = True
        batch: List[Dict[str, Any]] = []
        last_tweet_time = time.time()
        
        logger.info("NLP Processor started - consuming from queue with concurrent processing")
        
        try:
            while self.is_running:
                # Pre-fetch up to 50 tweets from queue (non-blocking)
                prefetch_buffer = []
                for _ in range(50):
                    tweet = input_queue_simulator.get_next()
                    if tweet:
                        prefetch_buffer.append(tweet)
                    else:
                        break
                
                if prefetch_buffer:
                    # Process all prefetched tweets concurrently
                    try:
                        processed_tweets = await self.process_batch_concurrent(prefetch_buffer)
                        batch.extend(processed_tweets)
                        last_tweet_time = time.time()
                        
                        # Emit batches when they reach batch_size
                        while len(batch) >= self.batch_size:
                            await self.processed_queue.put(batch[:self.batch_size])
                            logger.debug(f"Emitted batch: {self.batch_size} tweets processed")
                            batch = batch[self.batch_size:]
                            
                    except Exception as e:
                        logger.error(f"Error in concurrent batch processing: {e}")
                else:
                    # Queue was empty, yield control
                    await asyncio.sleep(0.01)
                    
                    # Flush partial batch if conditions met
                    if batch:
                        queue_empty = input_queue_simulator.queue_size() == 0
                        timeout_reached = (time.time() - last_tweet_time) >= self.flush_interval
                        
                        if queue_empty or timeout_reached:
                            await self.processed_queue.put(batch)
                            logger.debug(
                                f"Flushed batch: {len(batch)} tweets "
                                f"(empty={queue_empty}, timeout={timeout_reached})"
                            )
                            batch = []
                            last_tweet_time = time.time()
                
        except asyncio.CancelledError:
            logger.info("NLP Processor cancelled")
            if batch:
                await self.processed_queue.put(batch)
            self.is_running = False
        except Exception as e:
            logger.error(f"Error in NLP processor: {e}", exc_info=True)
            self.is_running = False
    
    async def get_batch(self) -> Optional[List[Dict[str, Any]]]:
        """
        Get next batch of processed tweets.
        
        Returns:
            List of processed tweets or None if timeout
        """
        try:
            return await asyncio.wait_for(self.processed_queue.get(), timeout=2.0)
        except asyncio.TimeoutError:
            return None
    
    def stop(self) -> None:
        """Stop the processor."""
        self.is_running = False
        logger.info("NLP Processor stopped")
