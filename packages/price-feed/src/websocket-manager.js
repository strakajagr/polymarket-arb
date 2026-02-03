import WebSocket from 'ws';
import { logger } from '@polymarket-arb/core';

export class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Set();
    this.subscribedMarkets = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      logger.info('Connecting to Polymarket WebSocket...', { url: this.url });

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Resubscribe to markets if reconnecting
        if (this.subscribedMarkets.size > 0) {
          this.subscribedMarkets.forEach(marketId => {
            this._sendSubscription(marketId);
          });
        }
        
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messageHandlers.forEach(handler => handler(message));
        } catch (err) {
          logger.error('Failed to parse WebSocket message', { error: err.message });
        }
      });

      this.ws.on('close', (code, reason) => {
        logger.warn('WebSocket closed', { code, reason: reason.toString() });
        this.isConnected = false;
        this._attemptReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message });
        if (!this.isConnected) {
          reject(error);
        }
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

  subscribe(marketId) {
    this.subscribedMarkets.add(marketId);
    if (this.isConnected) {
      this._sendSubscription(marketId);
    }
  }

  _sendSubscription(marketId) {
    const message = {
      type: 'subscribe',
      channel: 'market',
      market: marketId,
    };
    this.ws.send(JSON.stringify(message));
    logger.debug('Subscribed to market', { marketId });
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}
