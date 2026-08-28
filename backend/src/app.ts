import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { Logger } from './utils/logger';

// Route imports
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import materialsRoutes from './routes/materials.routes';
import ordersRoutes from './routes/orders.routes';
import quotesRoutes from './routes/quotes.routes';
import cadRoutes from './routes/cad.routes';
import manufacturingRoutes from './routes/manufacturing.routes';
import pricingAdminRoutes from './routes/pricing-admin.routes';
import adminRoutes from './routes/admin.routes';
import adminReportsRoutes from './routes/admin-reports.routes';
import adminSettingsRoutes from './routes/admin-settings.routes';

export const createApp = (): Application => {
  const app = express();

  // ─── Security & Middleware ─────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: ENV.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Baseline rate limiter for non-CAD API routes.
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/v1/cad-files'),
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } },
  });
  app.use('/api/', limiter);

  // CAD upload/processing workflows poll frequently; keep a dedicated higher budget.
  const cadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'CAD_RATE_LIMIT', message: 'Too many CAD operations. Please try again in a moment.' } },
  });
  app.use('/api/v1/cad-files', cadLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts. Please try again later.' } },
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  // Admin login is a prime credential-stuffing target; rate-limit it just like
  // the public auth endpoints (the admin-auth service also enforces lockout).
  app.use('/api/v1/auth/admin/login', authLimiter);

  // ─── Request Logging ──────────────────────────────────────────────
  app.use((req, _res, next) => {
    Logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // ─── API Routes ───────────────────────────────────────────────────
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/materials', materialsRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/quotes', quotesRoutes);
  app.use('/api/v1/cad-files', cadRoutes);
  app.use('/api/v1/manufacturing', manufacturingRoutes);
  app.use('/api/v1/admin/pricing', pricingAdminRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/admin/reports', adminReportsRoutes);
  app.use('/api/v1/admin/settings', adminSettingsRoutes);

  // ─── Global Error Handler ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
};
