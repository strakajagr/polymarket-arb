import { logger } from '@polymarket-arb/core';
import { ArbitrageBot } from './bot.js';
import { startHealthCheck } from './health-check.js';

async function main() {
  logger.info('='.repeat(50));
  logger.info('   POLYMARKET ARBITRAGE BOT');
  logger.info('='.repeat(50));

  const bot = new ArbitrageBot({
    bankroll: 10000, // $10k starting bankroll
  });

  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    bot.stop();
    process.exit(0);
  });

  try {
    await bot.initialize();
    
    // Start health check server (for Fargate)
    startHealthCheck(bot, 8080);
    
    // Start the bot
    await bot.start();

  } catch (error) {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();
