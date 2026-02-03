import { config, logger } from '@polymarket-arb/core';
import { WebSocketManager } from './websocket-manager.js';
import { PriceCache } from './price-cache.js';

export class PolymarketClient {
  constructor() {
    this.wsManager = new WebSocketManager(config.polymarket.wsUrl);
    this.priceCache = new PriceCache();
    this.markets = new Map(); // marketId -> market metadata
    this.tokenToMarket = new Map(); // tokenId -> marketId (for WS message routing)
  }

  async connect() {
    await this.wsManager.connect();

    // Handle incoming WebSocket messages
    this.wsManager.onMessage((message) => {
      this._handleMessage(message);
    });

    logger.info('PolymarketClient connected');
  }

  _handleMessage(message) {
    // Polymarket WebSocket message format varies
    // This handles price book updates
    
    if (message.event_type === 'book') {
      this._handleBookUpdate(message);
    } else if (message.event_type === 'price_change') {
      this._handlePriceChange(message);
    } else if (message.event_type === 'last_trade_price') {
      this._handleLastTradePrice(message);
    } else if (message.event_type === 'tick_size_change') {
      // Ignore tick size changes
    } else {
      logger.debug('Unknown message type', { type: message.event_type, keys: Object.keys(message) });
    }
  }

  _handleBookUpdate(message) {
    const { asset_id, bids, asks } = message;
    
    if (!asset_id) return;

    // Look up which market this token belongs to
    const marketId = this.tokenToMarket.get(asset_id);
    if (!marketId) {
      logger.debug('Received price for unknown token', { asset_id: asset_id.substring(0, 16) });
      return;
    }

    const marketData = this.markets.get(marketId);
    if (!marketData) return;

    // Get best bid and ask
    const bestBid = bids?.[0]?.price ? parseFloat(bids[0].price) : null;
    const bestAsk = asks?.[0]?.price ? parseFloat(asks[0].price) : null;
    
    // Use midpoint as price, or best available
    let price = null;
    if (bestBid && bestAsk) {
      price = (bestBid + bestAsk) / 2;
    } else if (bestBid) {
      price = bestBid;
    } else if (bestAsk) {
      price = bestAsk;
    }

    if (price === null) return;

    const isYes = asset_id === marketData.yesTokenId;
    const updateData = isYes 
      ? { yesPrice: price, yesTokenId: asset_id }
      : { noPrice: price, noTokenId: asset_id };

    this.priceCache.update(marketId, updateData);
  }

  _handlePriceChange(message) {
    const { price, asset_id } = message;
    
    if (price === undefined || !asset_id) return;

    const marketId = this.tokenToMarket.get(asset_id);
    if (!marketId) return;

    const marketData = this.markets.get(marketId);
    if (!marketData) return;

    const isYes = asset_id === marketData.yesTokenId;
    const updateData = isYes 
      ? { yesPrice: parseFloat(price) }
      : { noPrice: parseFloat(price) };

    this.priceCache.update(marketId, updateData);
  }

  _handleLastTradePrice(message) {
    const { price, asset_id } = message;
    
    if (price === undefined || !asset_id) return;

    const marketId = this.tokenToMarket.get(asset_id);
    if (!marketId) return;

    const marketData = this.markets.get(marketId);
    if (!marketData) return;

    const isYes = asset_id === marketData.yesTokenId;
    const updateData = isYes 
      ? { yesPrice: parseFloat(price) }
      : { noPrice: parseFloat(price) };

    this.priceCache.update(marketId, updateData);
  }

  /**
   * Fetch active markets from Polymarket API
   */
  async fetchMarkets(limit = 100) {
    try {
      const response = await fetch(
        `${config.polymarket.apiUrl}/markets?limit=${limit}&active=true`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const responseData = await response.json();
      
      // Handle the {data: [...]} wrapper
      const markets = responseData.data || responseData;
      
      if (!Array.isArray(markets)) {
        logger.warn('Unexpected markets response format', { type: typeof markets });
        return [];
      }
      
      let subscriptionCount = 0;
      
      // Store market metadata and subscribe to WebSocket
      for (const market of markets) {
        const marketId = market.condition_id;
        
        if (!marketId) continue;
        
        // Find YES and NO token IDs from tokens array
        const yesToken = market.tokens?.find(t => t.outcome === 'Yes');
        const noToken = market.tokens?.find(t => t.outcome === 'No');

        if (yesToken && noToken) {
          // Store market data
          this.markets.set(marketId, {
            id: marketId,
            question: market.question,
            slug: market.market_slug,
            yesTokenId: yesToken.token_id,
            noTokenId: noToken.token_id,
            yesPrice: parseFloat(yesToken.price) || null,
            noPrice: parseFloat(noToken.price) || null,
            endDate: market.end_date_iso,
            active: market.active,
          });

          // Map token IDs back to market ID for message routing
          this.tokenToMarket.set(yesToken.token_id, marketId);
          this.tokenToMarket.set(noToken.token_id, marketId);

          // Initialize price cache with current prices from REST API
          if (yesToken.price && noToken.price) {
            this.priceCache.update(marketId, {
              yesPrice: parseFloat(yesToken.price),
              noPrice: parseFloat(noToken.price),
              yesTokenId: yesToken.token_id,
              noTokenId: noToken.token_id,
            });
          }

          // Subscribe to live updates using TOKEN IDs (not market/condition ID)
          this.wsManager.subscribeToAssets(yesToken.token_id, noToken.token_id, marketId);
          subscriptionCount++;
        }
      }

      logger.info(`Fetched ${this.markets.size} markets, subscribed to ${subscriptionCount} token pairs`);
      return Array.from(this.markets.values());
      
    } catch (error) {
      logger.error('Failed to fetch markets', { error: error.message });
      throw error;
    }
  }

  /**
   * Get price cache for external monitoring
   */
  getPriceCache() {
    return this.priceCache;
  }

  /**
   * Get market metadata
   */
  getMarket(marketId) {
    return this.markets.get(marketId);
  }

  close() {
    this.wsManager.close();
  }
}
