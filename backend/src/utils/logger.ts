export class Logger {
  static info(message: string, ...args: unknown[]) {
    console.log(`[CAM-LABS INFO] [${new Date().toISOString()}] ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]) {
    console.warn(`[CAM-LABS WARN] [${new Date().toISOString()}] ${message}`, ...args);
  }

  static error(message: string, ...args: unknown[]) {
    console.error(`[CAM-LABS ERROR] [${new Date().toISOString()}] ${message}`, ...args);
  }

  static debug(message: string, ...args: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CAM-LABS DEBUG] [${new Date().toISOString()}] ${message}`, ...args);
    }
  }
}
