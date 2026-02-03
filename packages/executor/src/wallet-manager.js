import { ethers } from 'ethers';
import { config, logger } from '@polymarket-arb/core';

export class WalletManager {
  constructor() {
    this.wallet = null;
    this.address = null;
  }

  initialize() {
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
    return this.wallet.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    return this.wallet.signTypedData(domain, types, value);
  }
}
