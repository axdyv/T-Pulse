"""Queue processing system: simulate, process, and aggregate tweets."""


try:
    from .queue_simulator_redis import RedisQueueSimulator
except ImportError:
    RedisQueueSimulator = None

from .nlp_processor import NLPProcessor
from .aggregator import Aggregator

__all__ = ['RedisQueueSimulator', 'NLPProcessor', 'Aggregator']
