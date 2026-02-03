import WebSocket from 'ws';
import { logger } from '@polymarket-arb/core';

export class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageHandlers = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          // Some messages are plain text status responses, not JSON
          const text = data.toString();
          if (text !== 'INVALID OPERATION') {
            logger.debug('Non-JSON WebSocket message', { text: text.substring(0, 100) });
          }
          // Silently ignore INVALID OPERATION - we'll use REST API prices instead
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message });
        reject(error);
      });

      this.ws.on('close', () => {
        logger.warn('WebSocket closed');
        this._attemptReconnect();
      });
    });
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Reconnecting in ${delay}ms...`, { attempt: this.reconnectAttempts });
    
    setTimeout(() => {
      this.connect().catch(err => {
        logger.error('Reconnection failed', { error: err.message });
      });
    }, delay);
  }

  /**
   * Subscribe to a market's price updates
   * Polymarket requires subscribing to asset (token) IDs, not market IDs
   */
  subscribeToAssets(yesTokenId, noTokenId, marketId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not connected, cannot subscribe');
      return;
    }

    // Subscribe to both YES and NO tokens for this market
    // Format: {"type": "subscribe", "channel": "market", "market": "<TOKEN_ID>"}
    const subscribeYes = {
      type: 'subscribe',
      channel: 'market',
      market: yesTokenId
    };
    
    const subscribeNo = {
      type: 'subscribe',
      channel: 'market', 
      market: noTokenId
    };

    this.ws.send(JSON.stringify(subscribeYes));
    this.ws.send(JSON.stringify(subscribeNo));
    
    logger.debug('Subscribed to market tokens', { 
      marketId: marketId.substring(0, 16) + '...',
      yesToken: yesTokenId.substring(0, 16) + '...',
      noToken: noTokenId.substring(0, 16) + '...'
    });
  }

  // Keep old method for backward compatibility but deprecate it
  subscribe(marketId) {
    // This was subscribing with condition_id which doesn't work
    // Use subscribeToAssets instead
    logger.debug('Deprecated subscribe called', { marketId: marketId.substring(0, 16) + '...' });
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
