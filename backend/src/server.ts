import { createApp } from './app';
import { ENV, getEnvironmentIssues } from './config/env';
import { Logger } from './utils/logger';

const app = createApp();

const environmentIssues = getEnvironmentIssues();
if (environmentIssues.length > 0) {
  if (ENV.NODE_ENV === 'production') {
    throw new Error(`Invalid production configuration: ${environmentIssues.join(' ')}`);
  }
  environmentIssues.forEach((issue) => Logger.warn(`[Configuration] ${issue}`));
}

app.listen(ENV.PORT, () => {
  Logger.info(`
  ╔══════════════════════════════════════════════════╗
  ║   CAM LABS Manufacturing API Server              ║
  ║   Port:    ${String(ENV.PORT).padEnd(38)}║
  ║   Env:     ${ENV.NODE_ENV.padEnd(38)}║
  ║   Engine:   CAM LABS Internal Manufacturing       ║
  ╚══════════════════════════════════════════════════╝
  `);
  Logger.info(`API base URL: http://localhost:${ENV.PORT}/api/v1`);
  Logger.info(`Health check: http://localhost:${ENV.PORT}/api/v1/health`);
});
