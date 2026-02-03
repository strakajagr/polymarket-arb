/**
 * @typedef {Object} Market
 * @property {string} id - Market ID (condition_id)
 * @property {string} question - Market question
 * @property {string} slug - URL slug
 * @property {Token[]} tokens - YES and NO tokens
 * @property {boolean} active - Is market active
 * @property {string} endDate - Resolution date
 */

/**
 * @typedef {Object} Token
 * @property {string} id - Token ID
 * @property {string} outcome - "Yes" or "No"
 * @property {number} price - Current price (0-1)
 */

/**
 * @typedef {Object} PriceUpdate
 * @property {string} marketId - Market ID
 * @property {number} yesPrice - YES token price
 * @property {number} noPrice - NO token price
 * @property {number} timestamp - Update timestamp
 */

/**
 * @typedef {Object} Opportunity
 * @property {string} marketId - Market ID
 * @property {string} marketQuestion - Human readable question
 * @property {number} yesPrice - YES price
 * @property {number} noPrice - NO price
 * @property {number} edge - Profit per dollar (1 - yes - no)
 * @property {number} recommendedSize - Kelly-calculated position size
 * @property {number} expectedProfit - Edge * size
 * @property {number} timestamp - When detected
 */

/**
 * @typedef {Object} Order
 * @property {string} marketId - Market ID
 * @property {string} tokenId - Token to buy
 * @property {'BUY'|'SELL'} side - Order side
 * @property {number} price - Limit price
 * @property {number} size - Order size in USDC
 */

// Export empty object - types are just for documentation
export default {};
