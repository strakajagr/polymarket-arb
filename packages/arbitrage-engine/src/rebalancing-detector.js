import { logger, config, calculateKellySize, calculateArbProfit } from '@polymarket-arb/core';

export class RebalancingDetector {
  constructor(priceCache, options = {}) {
    this.priceCache = priceCache;
    this.minEdge = options.minEdge || config.bot.minProfitThreshold;
    this.maxPositionSize = options.maxPositionSize || config.bot.maxPositionSize;
    this.bankroll = options.bankroll || 10000; // Default $10k
    this.opportunityHandlers = new Set();
    this.activeOpportunities = new Map();
  }

  /**
   * Start monitoring for opportunities
   */
  start() {
    logger.info('RebalancingDetector started', { 
      minEdge: this.minEdge,
      maxPositionSize: this.maxPositionSize,
      bankroll: this.bankroll,
    });

    // Listen to every price update
    this.priceCache.onUpdate((priceData) => {
      this._checkForOpportunity(priceData);
    });
  }

  _checkForOpportunity(priceData) {
    const { marketId, yesPrice, noPrice } = priceData;

    // Need both prices
    if (typeof yesPrice !== 'number' || typeof noPrice !== 'number') {
      return;
    }

    const sum = yesPrice + noPrice;
    const edge = 1 - sum; // Positive edge = long opportunity (buy both)

    // Check if opportunity exists
    if (Math.abs(edge) >= this.minEdge) {
      const opportunity = this._createOpportunity(marketId, priceData, edge);
      
      // Only alert if this is a new or better opportunity
      const existing = this.activeOpportunities.get(marketId);
      if (!existing || Math.abs(edge) > Math.abs(existing.edge)) {
        this.activeOpportunities.set(marketId, opportunity);
        this._notifyOpportunity(opportunity);
      }
    } else {
      // Opportunity closed
      if (this.activeOpportunities.has(marketId)) {
        logger.debug('Opportunity closed', { marketId, sum });
        this.activeOpportunities.delete(marketId);
      }
    }
  }

  _createOpportunity(marketId, priceData, edge) {
    const { yesPrice, noPrice, yesTokenId, noTokenId } = priceData;
    
    // Calculate recommended position size using Kelly
    const kellySize = calculateKellySize(Math.abs(edge), this.bankroll, 0.25);
    const recommendedSize = Math.min(kellySize, this.maxPositionSize);

    // Calculate expected profit
    const profitCalc = calculateArbProfit(yesPrice, noPrice, recommendedSize);

    const opportunity = {
      marketId,
      type: edge > 0 ? 'LONG' : 'SHORT',
      yesPrice,
      noPrice,
      yesTokenId,
      noTokenId,
      sum: yesPrice + noPrice,
      edge: Math.abs(edge),
      edgePercent: (Math.abs(edge) * 100).toFixed(2) + '%',
      recommendedSize,
      expectedProfit: profitCalc.profit,
      timestamp: Date.now(),
    };

    return opportunity;
  }

  _notifyOpportunity(opportunity) {
    logger.opportunity(opportunity);
    this.opportunityHandlers.forEach(handler => handler(opportunity));
  }

  /**
   * Register handler for opportunities
   */
  onOpportunity(handler) {
    this.opportunityHandlers.add(handler);
    return () => this.opportunityHandlers.delete(handler);
  }

  /**
   * Get all active opportunities
   */
  getActiveOpportunities() {
    return Array.from(this.activeOpportunities.values());
  }

  /**
   * Manually check all cached prices for opportunities
   */
  scanAll() {
    const allPrices = this.priceCache.getAll();
    let found = 0;

    for (const priceData of allPrices) {
      if (this.priceCache.hasCompletePricing(priceData.marketId)) {
        this._checkForOpportunity(priceData);
        if (this.activeOpportunities.has(priceData.marketId)) {
          found++;
        }
      }
    }

    logger.info(`Scan complete: ${found} opportunities found`);
    return this.getActiveOpportunities();
  }
}
