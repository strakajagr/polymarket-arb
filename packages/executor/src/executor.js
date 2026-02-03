import { logger, config } from '@polymarket-arb/core';
import { WalletManager } from './wallet-manager.js';
import { OrderBuilder } from './order-builder.js';
import { TransactionSubmitter } from './transaction-submitter.js';

export class Executor {
  constructor() {
    this.wallet = new WalletManager();
    this.orderBuilder = null;
    this.submitter = null;
    this.executionHistory = [];
  }

  initialize() {
    this.wallet.initialize();
    this.orderBuilder = new OrderBuilder(this.wallet);
    this.submitter = new TransactionSubmitter(this.wallet);
    
    logger.info('Executor initialized', { 
      address: this.wallet.getAddress(),
      dryRun: config.bot.dryRun,
    });

    return this;
  }

  /**
   * Execute an arbitrage opportunity
   */
  async execute(opportunity) {
    const startTime = Date.now();

    try {
      // Build orders
      const { yesOrder, noOrder } = this.orderBuilder.buildArbOrders(opportunity);

      // Sign orders (Polymarket uses EIP-712 typed data)
      // For now, we'll use simple message signing
      // Full implementation needs proper EIP-712 domain and types
      const yesSignature = await this.wallet.signMessage(
        JSON.stringify(yesOrder)
      );
      const noSignature = await this.wallet.signMessage(
        JSON.stringify(noOrder)
      );

      // Submit orders
      const result = await this.submitter.executeArbitrage(
        yesOrder, yesSignature,
        noOrder, noSignature
      );

      // Record execution
      const execution = {
        opportunity,
        result,
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
      this.executionHistory.push(execution);

      return result;

    } catch (error) {
      logger.error('Execution failed', { 
        error: error.message,
        marketId: opportunity.marketId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(e => e.result.success).length;
    const totalProfit = this.executionHistory
      .filter(e => e.result.success)
      .reduce((sum, e) => sum + e.opportunity.expectedProfit, 0);

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: total - successful,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) + '%' : 'N/A',
      totalExpectedProfit: totalProfit.toFixed(2),
    };
  }
}
