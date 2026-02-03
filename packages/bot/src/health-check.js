import http from 'http';
import { logger } from '@polymarket-arb/core';

export function startHealthCheck(bot, port = 8080) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const stats = bot.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: stats.startTime ? Date.now() - stats.startTime : 0,
        ...stats,
      }));
    } else if (req.url === '/stats') {
      const stats = bot.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    logger.info(`Health check server running on port ${port}`);
  });

  return server;
}
