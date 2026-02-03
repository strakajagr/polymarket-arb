/**
 * Calculate Kelly criterion bet size
 * 
 * For arbitrage, we're not betting on probability - we're locking in guaranteed profit.
 * Kelly here helps us size based on edge magnitude and bankroll.
 * 
 * @param {number} edge - Expected profit per dollar (e.g., 0.02 = 2% profit)
 * @param {number} bankroll - Total available capital
 * @param {number} fraction - Kelly fraction (0.25 = quarter Kelly, safer)
 * @returns {number} Recommended position size
 */
export function calculateKellySize(edge, bankroll, fraction = 0.25) {
  // For risk-free arbitrage, full Kelly would be 100% of bankroll
  // But we use fractional Kelly for safety (execution risk, etc.)
  
  if (edge <= 0) return 0;
  
  // Scale by edge - bigger edge = bigger position
  const kellyFraction = Math.min(edge * 10, 1); // Cap at 100%
  const adjustedFraction = kellyFraction * fraction;
  
  return Math.floor(bankroll * adjustedFraction * 100) / 100;
}

/**
 * Calculate profit from arbitrage opportunity
 * 
 * @param {number} yesPrice - Price of YES token (e.g., 0.52)
 * @param {number} noPrice - Price of NO token (e.g., 0.46)
 * @param {number} positionSize - Amount to spend on each side
 * @returns {object} Profit breakdown
 */
export function calculateArbProfit(yesPrice, noPrice, positionSize) {
  const totalCost = (yesPrice + noPrice) * positionSize;
  const payout = positionSize; // One side always pays $1 per share
  const profit = payout - totalCost;
  const profitPercent = (profit / totalCost) * 100;

  return {
    totalCost,
    payout,
    profit,
    profitPercent,
    edge: 1 - (yesPrice + noPrice),
  };
}
