import { logger, config } from '@polymarket-arb/core';

export class OpportunityValidator {
  constructor(options = {}) {
    this.minEdge = options.minEdge || config.bot.minProfitThreshold;
    this.maxAge = options.maxAge || 5000; // 5 seconds
    this.minLiquidity = options.minLiquidity || 100; // $100 minimum
  }

  /**
   * Validate opportunity before execution
   * Returns { valid: boolean, reason?: string }
   */
  validate(opportunity, currentPrices) {
    // Check if opportunity is stale
    const age = Date.now() - opportunity.timestamp;
    if (age > this.maxAge) {
      return { valid: false, reason: `Opportunity too old: ${age}ms` };
    }

    // Re-check prices if provided
    if (currentPrices) {
      const { yesPrice, noPrice } = currentPrices;
      const currentSum = yesPrice + noPrice;
      const currentEdge = Math.abs(1 - currentSum);

      if (currentEdge < this.minEdge) {
        return { 
          valid: false, 
          reason: `Edge evaporated: was ${opportunity.edge.toFixed(4)}, now ${currentEdge.toFixed(4)}` 
        };
      }

      // Prices moved significantly
      if (Math.abs(yesPrice - opportunity.yesPrice) > 0.01 ||
          Math.abs(noPrice - opportunity.noPrice) > 0.01) {
        return {
          valid: false,
          reason: 'Prices moved >1 cent since detection',
        };
      }
    }

    // Check minimum profit
    if (opportunity.expectedProfit < 0.50) {
      return { valid: false, reason: `Profit too small: $${opportunity.expectedProfit.toFixed(2)}` };
    }

    return { valid: true };
  }

  /**
   * Score opportunity for prioritization
   * Higher score = better opportunity
   */
  score(opportunity) {
    let score = 0;

    // Edge is most important (0-50 points)
    score += Math.min(opportunity.edge * 1000, 50);

    // Profit potential (0-30 points)
    score += Math.min(opportunity.expectedProfit, 30);

    // Freshness (0-20 points)
    const age = Date.now() - opportunity.timestamp;
    score += Math.max(0, 20 - (age / 250)); // Lose 1 point per 250ms

    return score;
  }

  /**
   * Rank opportunities by score
   */
  rank(opportunities) {
    return opportunities
      .map(opp => ({ ...opp, score: this.score(opp) }))
      .sort((a, b) => b.score - a.score);
  }
}
