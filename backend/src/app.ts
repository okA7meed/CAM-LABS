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
import technicalDocumentsRoutes from './routes/technicalDocuments.routes';
import manufacturingRoutes from './routes/manufacturing.routes';
import pricingAdminRoutes from './routes/pricing-admin.routes';
import adminRoutes from './routes/admin.routes';
import adminReportsRoutes from './routes/admin-reports.routes';
import adminSettingsRoutes from './routes/admin-settings.routes';
import adminCouponsRoutes from './routes/admin-coupons.routes';
import adminShippingRoutes from './routes/admin-shipping.routes';

export const createApp = (): Application => {
  const app = express();

  // ─── Security & Middleware ─────────────────────────────────────────
  app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Google Identity Services SDK + its relay frames. GIS is loaded
      // lazily only when the user clicks "Continue with Google".
      scriptSrc: ["'self'", 'https://accounts.google.com', 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://oauth2.googleapis.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
// Add HSTS for production environments
if (process.env.NODE_ENV === 'production') {
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
}

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
    skip: (req) => req.path.startsWith('/v1/cad-files') || req.path.startsWith('/v1/technical-documents'),
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
  app.use('/api/v1/auth/google', authLimiter);

  // Password-reset endpoints carry their own budgets on top of the
  // service-level protections (per-email cooldown, 5-attempt OTP lock):
  // forgot-password is the email-bombing surface, verify is brute-force
  // bounded per challenge, reset is the credential-changing surface.
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMIT', message: 'Too many reset requests. Please try again later.' } },
  });
  app.use('/api/v1/auth/forgot-password', forgotPasswordLimiter);

  const verifyCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMIT', message: 'Too many verification attempts. Please try again later.' } },
  });
  app.use('/api/v1/auth/verify-reset-code', verifyCodeLimiter);

  const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMIT', message: 'Too many password changes. Please try again later.' } },
  });
  app.use('/api/v1/auth/reset-password', resetPasswordLimiter);

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
  app.use('/api/v1/technical-documents', technicalDocumentsRoutes);
  app.use('/api/v1/manufacturing', manufacturingRoutes);
  app.use('/api/v1/admin/pricing', pricingAdminRoutes);
  app.use('/api/v1/admin/coupons', adminCouponsRoutes);
  app.use('/api/v1/admin/shipping', adminShippingRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/admin/reports', adminReportsRoutes);
  app.use('/api/v1/admin/settings', adminSettingsRoutes);

  // ─── Global Error Handler ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
};
