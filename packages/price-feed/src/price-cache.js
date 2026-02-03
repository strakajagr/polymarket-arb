import { logger } from '@polymarket-arb/core';

export class PriceCache {
  constructor() {
    // Map of marketId -> { yesPrice, noPrice, yesTokenId, noTokenId, timestamp }
    this.prices = new Map();
    this.updateHandlers = new Set();
  }

  update(marketId, priceData) {
    const previous = this.prices.get(marketId);
    const updated = {
      ...previous,
      ...priceData,
      timestamp: Date.now(),
    };
    
    this.prices.set(marketId, updated);

    // Notify handlers of price update
    this.updateHandlers.forEach(handler => {
      handler({
        marketId,
        ...updated,
      });
    });

    return updated;
  }

  get(marketId) {
    return this.prices.get(marketId);
  }

  getAll() {
    return Array.from(this.prices.entries()).map(([marketId, data]) => ({
      marketId,
      ...data,
    }));
  }

  onUpdate(handler) {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  /**
   * Check if we have both YES and NO prices for a market
   */
  hasCompletePricing(marketId) {
    const data = this.prices.get(marketId);
    return data && 
           typeof data.yesPrice === 'number' && 
           typeof data.noPrice === 'number';
  }
}
