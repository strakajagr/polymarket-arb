const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataStr}`;
}

export const logger = {
  debug: (message, data) => {
    if (currentLevel <= LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, data));
    }
  },

  info: (message, data) => {
    if (currentLevel <= LEVELS.INFO) {
      console.log(formatMessage('INFO', message, data));
    }
  },

  warn: (message, data) => {
    if (currentLevel <= LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, data));
    }
  },

  error: (message, data) => {
    if (currentLevel <= LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, data));
    }
  },

  opportunity: (opp) => {
    console.log(formatMessage('💰 OPPORTUNITY', '', opp));
  },

  trade: (trade) => {
    console.log(formatMessage('🔥 TRADE', '', trade));
  },
};
