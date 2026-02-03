import { ethers } from 'ethers';
import { config, logger } from '@polymarket-arb/core';

export class WalletManager {
  constructor() {
    this.wallet = null;
    this.address = null;
    this.isDryRun = config.bot.dryRun;
  }

  initialize() {
    if (this.isDryRun && !config.privateKey) {
      // Use a dummy address for dry run
      this.address = '0xDRY_RUN_MODE_NO_WALLET';
      logger.info('Wallet initialized in DRY RUN mode (no real wallet)');
      return this;
    }

    if (!config.privateKey) {
      throw new Error('Private key not configured');
    }

    // Remove 0x prefix if present
    const key = config.privateKey.startsWith('0x') 
      ? config.privateKey 
      : `0x${config.privateKey}`;

    this.wallet = new ethers.Wallet(key);
    this.address = this.wallet.address;

    logger.info('Wallet initialized', { address: this.address });
    return this;
  }

  getAddress() {
    return this.address;
  }

  async signMessage(message) {
    if (this.isDryRun) {
      return 'DRY_RUN_SIGNATURE';
    }
    return this.wallet.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    if (this.isDryRun) {
      return 'DRY_RUN_SIGNATURE';
    }
    return this.wallet.signTypedData(domain, types, value);
  }
}
