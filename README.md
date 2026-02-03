# Polymarket Arbitrage Bot

Event-driven arbitrage detection and execution system for Polymarket.

## Architecture

- **core**: Shared types, utilities, configuration
- **price-feed**: WebSocket connection to Polymarket
- **arbitrage-engine**: Opportunity detection algorithms
- **executor**: Trade signing and submission
- **bot**: Main orchestrator process
- **infrastructure**: AWS CDK for Fargate deployment

## Quick Start
```bash
npm install
cp .env.example .env
# Fill in your credentials
npm run dev
```

## Strategies

1. **Market Rebalancing**: YES + NO ≠ $1.00 → guaranteed profit
2. **Sharp Line Divergence**: Polymarket vs Pinnacle mispricing
3. **Combinatorial Arbitrage**: Cross-market logical impossibilities
