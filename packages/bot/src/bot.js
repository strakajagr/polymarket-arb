import { logger, config, validateConfig } from '@polymarket-arb/core';
import { PolymarketClient } from '@polymarket-arb/price-feed';
import { RebalancingDetector, OpportunityValidator } from '@polymarket-arb/arbitrage-engine';
import { Executor } from '@polymarket-arb/executor';

export class ArbitrageBot {
  constructor(options = {}) {
    this.options = {
      bankroll: options.bankroll || 10000,
      maxConcurrentExecutions: options.maxConcurrentExecutions || 1,
      marketFetchInterval: options.marketFetchInterval || 60000, // 1 min
      ...options,
    };

    this.polymarket = null;
    this.detector = null;
    this.validator = null;
    this.executor = null;

    this.isRunning = false;
    this.pendingExecutions = 0;
    this.stats = {
      startTime: null,
      opportunitiesDetected: 0,
      opportunitiesExecuted: 0,
      totalProfit: 0,
    };
  }

  async initialize() {
    logger.info('Initializing ArbitrageBot...', { 
      dryRun: config.bot.dryRun,
      bankroll: this.options.bankroll,
    });

    // Validate config
    validateConfig();

    // Initialize components
    this.polymarket = new PolymarketClient();
    this.executor = new Executor().initialize();

    // Connect to Polymarket
    await this.polymarket.connect();

    // Fetch initial markets
    await this.polymarket.fetchMarkets(200);

    // Set up arbitrage detection
    this.detector = new RebalancingDetector(
      this.polymarket.getPriceCache(),
      {
        bankroll: this.options.bankroll,
        minEdge: config.bot.minProfitThreshold,
        maxPositionSize: config.bot.maxPositionSize,
      }
    );

    this.validator = new OpportunityValidator();

    // Wire up opportunity handler
    this.detector.onOpportunity((opportunity) => {
      this._handleOpportunity(opportunity);
    });

    logger.info('ArbitrageBot initialized');
    return this;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();

    logger.info('🚀 ArbitrageBot started!', {
      minProfitThreshold: config.bot.minProfitThreshold,
      maxPositionSize: config.bot.maxPositionSize,
      dryRun: config.bot.dryRun,
    });

    // Start the detector
    this.detector.start();

    // Do initial scan
    this.detector.scanAll();

    // Periodically refresh markets
    this._startMarketRefresh();

    // Keep process alive and log stats
    this._startStatsReporter();
  }

  async _handleOpportunity(opportunity) {
    this.stats.opportunitiesDetected++;

    // Check if we can execute
    if (this.pendingExecutions >= this.options.maxConcurrentExecutions) {
      logger.debug('Skipping opportunity - max concurrent executions reached');
      return;
    }

    // Validate opportunity
    const currentPrices = this.polymarket.getPriceCache().get(opportunity.marketId);
    const validation = this.validator.validate(opportunity, currentPrices);

    if (!validation.valid) {
      logger.debug('Opportunity invalid', { reason: validation.reason });
      return;
    }

    // Execute!
    this.pendingExecutions++;

    try {
      logger.info('🎯 Executing opportunity', {
        marketId: opportunity.marketId,
        edge: opportunity.edgePercent,
        expectedProfit: `$${opportunity.expectedProfit.toFixed(2)}`,
      });

      const result = await this.executor.execute(opportunity);

      if (result.success) {
        this.stats.opportunitiesExecuted++;
        this.stats.totalProfit += opportunity.expectedProfit;
      }

    } finally {
      this.pendingExecutions--;
    }
  }

  _startMarketRefresh() {
    setInterval(async () => {
      try {
        await this.polymarket.fetchMarkets(200);
        this.detector.scanAll();
      } catch (error) {
        logger.error('Market refresh failed', { error: error.message });
      }
    }, this.options.marketFetchInterval);
  }

  _startStatsReporter() {
    setInterval(() => {
      const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;

      logger.info('📊 Bot Stats', {
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        opportunitiesDetected: this.stats.opportunitiesDetected,
        opportunitiesExecuted: this.stats.opportunitiesExecuted,
        expectedProfit: `$${this.stats.totalProfit.toFixed(2)}`,
        executorStats: this.executor.getStats(),
      });
    }, 60000); // Every minute
  }

  stop() {
    this.isRunning = false;
    this.polymarket?.close();
    logger.info('ArbitrageBot stopped');
  }

  getStats() {
    return {
      ...this.stats,
      executorStats: this.executor?.getStats(),
      activeOpportunities: this.detector?.getActiveOpportunities().length || 0,
    };
  }
}
