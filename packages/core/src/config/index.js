import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

export const config = {
  // Polymarket
  polymarket: {
    apiKey: process.env.POLYMARKET_API_KEY || '',
    secret: process.env.POLYMARKET_SECRET || '',
    passphrase: process.env.POLYMARKET_PASSPHRASE || '',
    wsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    apiUrl: 'https://clob.polymarket.com',
  },

  // Wallet
  privateKey: process.env.PRIVATE_KEY || '',

  // Bot settings
  bot: {
    minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.02'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '100'),
    dryRun: process.env.DRY_RUN === 'true',
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
};

export function validateConfig() {
  const required = ['privateKey'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0 && !config.bot.dryRun) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
  
  return true;
}
