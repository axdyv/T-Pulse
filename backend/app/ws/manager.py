"""
WebSocket Manager: Handles client connections and message broadcasting.
"""
import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasting.
    
    Thread-safe connection management for real-time updates.
    """
    
    def __init__(self):
        """Initialize connection manager."""
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, client_id: str, websocket: WebSocket) -> None:
        """
        Register a new WebSocket connection.
        
        Args:
            client_id: Unique client identifier
            websocket: WebSocket connection object
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected. Total: {len(self.active_connections)}")
        
        # Send welcome message
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to T-Pulse real-time feed",
            "client_id": client_id
        })
    
    async def disconnect(self, client_id: str) -> None:
        """
        Remove a WebSocket connection.
        
        Args:
            client_id: Client identifier to disconnect
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcast message to all connected clients.
        
        Args:
            message: Dict to send as JSON to all clients
        """
        disconnected = []
        
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to {client_id}: {e}")
                disconnected.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)
    
    async def broadcast_tweets(self, tweets: list[Dict[str, Any]]) -> None:
        """
        Broadcast tweet batch to all clients.
        
        Args:
            tweets: List of processed tweets
        """
        message = {
            "type": "tweets",
            "data": tweets,
            "count": len(tweets)
        }
        await self.broadcast(message)
    
    async def broadcast_stats(self, stats: Dict[str, Any]) -> None:
        """
        Broadcast aggregated stats to all clients.
        
        Args:
            stats: Statistics object with emotion scores, regions, etc.
        """
        message = {
            "type": "stats",
            "data": stats
        }
        await self.broadcast(message)
    
    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.active_connections)


# Global manager instance
manager = ConnectionManager()
