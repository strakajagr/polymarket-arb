import { config, logger } from '@polymarket-arb/core';

export class TransactionSubmitter {
  constructor(walletManager) {
    this.wallet = walletManager;
    this.apiUrl = config.polymarket.apiUrl;
    this.dryRun = config.bot.dryRun;
  }

  /**
   * Submit order to Polymarket CLOB
   */
  async submitOrder(order, signature) {
    if (this.dryRun) {
      logger.info('DRY RUN - Would submit order', { 
        tokenId: order.tokenId,
        side: order.side === 0 ? 'BUY' : 'SELL',
      });
      return { success: true, dryRun: true, orderId: 'dry-run-' + Date.now() };
    }

    try {
      const response = await fetch(`${this.apiUrl}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order,
          signature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Order submission failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      logger.trade({ orderId: result.orderID, ...order });
      return { success: true, orderId: result.orderID };

    } catch (error) {
      logger.error('Order submission failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute arbitrage - submit both orders
   */
  async executeArbitrage(yesOrder, yesSignature, noOrder, noSignature) {
    logger.info('Executing arbitrage...', { dryRun: this.dryRun });

    // Submit both orders concurrently for speed
    const [yesResult, noResult] = await Promise.all([
      this.submitOrder(yesOrder, yesSignature),
      this.submitOrder(noOrder, noSignature),
    ]);

    const success = yesResult.success && noResult.success;

    if (success) {
      logger.info('✅ Arbitrage executed successfully', {
        yesOrderId: yesResult.orderId,
        noOrderId: noResult.orderId,
      });
    } else {
      logger.error('❌ Arbitrage execution failed', { yesResult, noResult });
    }

    return { success, yesResult, noResult };
  }
}
