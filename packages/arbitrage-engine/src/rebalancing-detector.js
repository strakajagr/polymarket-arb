import { calculateKellySize, calculateArbProfit, logger } from '@polymarket-arb/core';

export class RebalancingDetector {
  constructor(priceCache, options = {}) {
    this.priceCache = priceCache;
    this.minEdge = options.minEdge || 0.02; // 2% minimum edge
    this.maxPositionSize = options.maxPositionSize || 100;
    this.bankroll = options.bankroll || 10000;
    this.opportunities = new Map();
    this.handlers = [];
    this.edgeStats = { count: 0, totalEdge: 0, maxEdge: 0, opportunities: 0 };
    this.lastStatsLog = Date.now();
  }

  start() {
    // Listen for price updates
    this.priceCache.onUpdate((marketId, prices) => {
      this._checkForArbitrage(marketId, prices);
    });

    logger.info('RebalancingDetector started', {
      minEdge: this.minEdge,
      maxPositionSize: this.maxPositionSize,
      bankroll: this.bankroll
    });
  }

  _checkForArbitrage(marketId, prices) {
    const { yesPrice, noPrice, yesTokenId, noTokenId } = prices;

    // Need both prices
    if (!yesPrice || !noPrice) return;

    // Calculate edge: if YES + NO < 1, there's arbitrage by buying both
    // if YES + NO > 1, there's no simple rebalancing arb (would need to short)
    const totalPrice = yesPrice + noPrice;
    const edge = 1 - totalPrice; // Positive = profit opportunity

    // Track stats for monitoring
    this.edgeStats.count++;
    this.edgeStats.totalEdge += Math.abs(edge);
    if (Math.abs(edge) > Math.abs(this.edgeStats.maxEdge)) {
      this.edgeStats.maxEdge = edge;
    }

    // Log stats every 30 seconds
    if (Date.now() - this.lastStatsLog > 30000) {
      const avgEdge = this.edgeStats.count > 0 
        ? (this.edgeStats.totalEdge / this.edgeStats.count * 100).toFixed(3)
        : 0;
      logger.info('Edge statistics', {
        checksPerformed: this.edgeStats.count,
        avgAbsEdge: `${avgEdge}%`,
        maxEdge: `${(this.edgeStats.maxEdge * 100).toFixed(3)}%`,
        opportunitiesFound: this.edgeStats.opportunities,
        threshold: `${(this.minEdge * 100).toFixed(1)}%`
      });
      this.lastStatsLog = Date.now();
      // Reset for next period
      this.edgeStats = { count: 0, totalEdge: 0, maxEdge: 0, opportunities: this.edgeStats.opportunities };
    }

    // Only interested in positive edges (buy both sides for guaranteed profit)
    if (edge < this.minEdge) {
      // Clear any existing opportunity for this market
      if (this.opportunities.has(marketId)) {
        this.opportunities.delete(marketId);
        logger.debug('Opportunity closed', { marketId: marketId.substring(0, 16) });
      }
      return;
    }

    this.edgeStats.opportunities++;

    // Calculate Kelly-optimal position size
    const kellySize = calculateKellySize(edge, this.bankroll);
    const positionSize = Math.min(kellySize, this.maxPositionSize);

    // Calculate expected profit
    const { profit, profitPercent } = calculateArbProfit(
      yesPrice, 
      noPrice, 
      positionSize
    );

    const opportunity = {
      marketId,
      yesPrice,
      noPrice,
      yesTokenId,
      noTokenId,
      edge,
      positionSize,
      expectedProfit: profit,
      profitPercent,
      timestamp: Date.now()
    };

    // Check if this is a new or improved opportunity
    const existing = this.opportunities.get(marketId);
    if (!existing || opportunity.edge > existing.edge) {
      this.opportunities.set(marketId, opportunity);
      
      logger.opportunity('🎯 ARBITRAGE OPPORTUNITY DETECTED', {
        edge: `${(edge * 100).toFixed(2)}%`,
        yesPrice: yesPrice.toFixed(4),
        noPrice: noPrice.toFixed(4),
        total: totalPrice.toFixed(4),
        positionSize: `$${positionSize.toFixed(2)}`,
        expectedProfit: `$${profit.toFixed(2)}`,
        marketId: marketId.substring(0, 20) + '...'
      });

      // Notify handlers
      this.handlers.forEach(handler => handler(opportunity));
    }
  }

  /**
   * Get current active opportunities
   */
  getOpportunities() {
    return Array.from(this.opportunities.values());
  }

  /**
   * Manually scan all cached prices
   */
  scanAll() {
    const allPrices = this.priceCache.getAll();
    let count = 0;
    
    for (const [marketId, prices] of allPrices) {
      this._checkForArbitrage(marketId, prices);
      count++;
    }
    
    logger.info(`Scan complete: ${this.opportunities.size} opportunities found`);
    return this.getOpportunities();
  }

  onOpportunity(handler) {
    this.handlers.push(handler);
  }
}
