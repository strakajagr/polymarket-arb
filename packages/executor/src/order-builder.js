import { logger } from '@polymarket-arb/core';
import crypto from 'crypto';

export class OrderBuilder {
  constructor(walletManager) {
    this.wallet = walletManager;
  }

  /**
   * Build a limit order for Polymarket CLOB
   */
  buildOrder(params) {
    const {
      tokenId,
      side, // 'BUY' or 'SELL'
      price,
      size,
    } = params;

    const order = {
      salt: this._generateSalt(),
      maker: this.wallet.getAddress(),
      signer: this.wallet.getAddress(),
      taker: '0x0000000000000000000000000000000000000000',
      tokenId: tokenId,
      makerAmount: this._toWei(side === 'BUY' ? size * price : size),
      takerAmount: this._toWei(side === 'BUY' ? size : size * price),
      side: side === 'BUY' ? 0 : 1,
      expiration: Math.floor(Date.now() / 1000) + 60 * 5, // 5 min expiry
      nonce: 0,
      feeRateBps: 0,
      signatureType: 0,
    };

    logger.debug('Order built', { tokenId, side, price, size });
    return order;
  }

  /**
   * Build paired orders for arbitrage (buy YES and NO)
   */
  buildArbOrders(opportunity) {
    const { yesTokenId, noTokenId, yesPrice, noPrice, recommendedSize } = opportunity;

    const yesOrder = this.buildOrder({
      tokenId: yesTokenId,
      side: 'BUY',
      price: yesPrice,
      size: recommendedSize,
    });

    const noOrder = this.buildOrder({
      tokenId: noTokenId,
      side: 'BUY',
      price: noPrice,
      size: recommendedSize,
    });

    return { yesOrder, noOrder };
  }

  _generateSalt() {
    return BigInt('0x' + crypto.randomBytes(32).toString('hex')).toString();
  }

  _toWei(amount) {
    // USDC has 6 decimals
    return Math.floor(amount * 1e6).toString();
  }
}
